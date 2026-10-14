import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clientKey } from "@/lib/rate-limit";

/** Longest single meeting on any plan. */
export const MAX_MEETING_SEC = 4 * 60 * 60;
/** Longest single chunk a client may claim (recorders rotate every 4 minutes). */
export const MAX_CHUNK_SEC = 300;
/** A meeting still "recording" this long after its last chunk is finished automatically. */
export const STALE_MEETING_MS = 30 * 60 * 1000;
/** Signed-out demo: requests per feature per 24 hours, and the largest inputs accepted. */
export const ANON_LIMIT = 5;
export const ANON_WINDOW_MS = 24 * 60 * 60 * 1000;
export const ANON_MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const ANON_MAX_TEXT_CHARS = 2_000;
/** Single dictation caps: 10 MB of audio, and the recorders stop themselves at 10 minutes. */
export const MAX_DICTATION_BYTES = 10 * 1024 * 1024;
export const MAX_DICTATION_SEC = 10 * 60;
/** Signed-in users need this much weekly allowance left to start a dictation. */
export const MIN_WORDS_TO_START = 50;
const WAV_BYTES_PER_SEC = 16_000 * 2; // 16 kHz mono 16-bit, what the desktop capture uploads

/** Dictation words are metered by the server as soon as the transcript exists, never by the client. */
export async function meterDictation(userId: string, words: number) {
  if (words <= 0) return;
  await prisma.usageRecord.create({ data: { userId, kind: "dictation", words } });
}

/**
 * Meters one meeting chunk index exactly once (the first track to arrive wins), as it happens, so a meeting that is
 * never finished is still counted. Seconds are capped by the client's claim, the wall clock since the meeting started
 * minus what was already metered, a per-chunk ceiling, and for WAV uploads the byte length.
 * Returns the seconds metered for this call (0 when the sibling track already did it).
 */
export async function meterMeetingChunk(opts: {
  userId: string;
  meetingId: string;
  chunkId: string;
  index: number;
  startedAt: Date;
  clientDurationSec: number;
  bytes: number;
  mime: string;
}): Promise<number> {
  const agg = await prisma.meetingChunk.aggregate({ where: { meetingId: opts.meetingId }, _sum: { meteredSec: true } });
  const already = agg._sum.meteredSec ?? 0;
  const wall = Math.max(0, (Date.now() - opts.startedAt.getTime()) / 1000 - already);
  let seconds = Math.min(Math.max(0, opts.clientDurationSec || 0), wall, MAX_CHUNK_SEC);
  if (/wav|wave/i.test(opts.mime)) seconds = Math.min(seconds, opts.bytes / WAV_BYTES_PER_SEC);
  seconds = Math.round(seconds * 10) / 10;
  if (seconds <= 0) return 0;
  // Atomic "first track for this index": only writes when no sibling row of the same index has metered anything.
  const updated = await prisma.$executeRaw(Prisma.sql`
    UPDATE "MeetingChunk" SET "meteredSec" = ${seconds}
    WHERE "id" = ${opts.chunkId} AND "meteredSec" = 0
      AND NOT EXISTS (SELECT 1 FROM "MeetingChunk" c WHERE c."meetingId" = ${opts.meetingId} AND c."index" = ${opts.index} AND c."meteredSec" > 0)`);
  if (updated === 0) return 0;
  await prisma.usageRecord.create({ data: { userId: opts.userId, kind: "meeting", seconds: Math.round(seconds) } });
  return seconds;
}

/** Total seconds metered for a meeting so far. */
export async function meteredMeetingSec(meetingId: string) {
  const agg = await prisma.meetingChunk.aggregate({ where: { meetingId }, _sum: { meteredSec: true } });
  return agg._sum.meteredSec ?? 0;
}

function anonKey(feature: string, req: Request) {
  const salt = process.env.AUTH_SECRET ?? "shunbo";
  return `${feature}:${createHash("sha256").update(`${salt}:${clientKey(req)}`).digest("hex").slice(0, 32)}`;
}

/**
 * Server-side allowance for the signed-out demo: ANON_LIMIT requests per feature per 24 h per (hashed) client IP.
 * Consumes one request and reports whether it was within the allowance.
 */
export async function anonymousAllow(feature: "transcribe" | "clean", req: Request): Promise<{ ok: boolean; used: number; limit: number }> {
  const key = anonKey(feature, req);
  const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    INSERT INTO "AnonymousUsage" ("key", "count", "windowStart") VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "AnonymousUsage"."windowStart" < NOW() - (${ANON_WINDOW_MS}::double precision / 1000) * INTERVAL '1 second' THEN 1 ELSE "AnonymousUsage"."count" + 1 END,
      "windowStart" = CASE WHEN "AnonymousUsage"."windowStart" < NOW() - (${ANON_WINDOW_MS}::double precision / 1000) * INTERVAL '1 second' THEN NOW() ELSE "AnonymousUsage"."windowStart" END
    RETURNING "count"`);
  const used = Number(rows[0]?.count ?? 1);
  return { ok: used <= ANON_LIMIT, used, limit: ANON_LIMIT };
}
