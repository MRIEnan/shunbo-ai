import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateNotes, classifyTextLanguage, type Notes } from "@/lib/meetings";
import { STALE_MEETING_MS } from "@/lib/metering";
import { getMaintenance } from "@/lib/maintenance";

export type FinishResult = { status: "done" | "failed"; notes?: Notes; language?: string | null; error?: string };

/**
 * Ends a meeting and writes its notes from the stored segments. Minutes are metered per chunk as they arrive
 * (see `meterMeetingChunk`), so finishing never creates usage. Safe to call for a meeting that already ended.
 */
export async function finalizeMeeting(id: string, opts: { durationSec?: number; regenerate?: boolean; reason?: string } = {}): Promise<FinishResult> {
  const meeting = await prisma.meeting.findUnique({ where: { id }, include: { segments: { orderBy: { startSec: "asc" } } } });
  if (!meeting) return { status: "failed", error: "Not found" };
  const durationSec = Math.max(meeting.durationSec, opts.durationSec ?? 0);

  if (meeting.status === "recording") {
    await prisma.meeting.update({ where: { id }, data: { status: "processing", endedAt: new Date(), durationSec, error: opts.reason ?? null } });
  } else if (meeting.status === "done" && !opts.regenerate) {
    return { status: "done" };
  } else {
    await prisma.meeting.update({ where: { id }, data: { status: "processing" } });
  }

  try {
    // Language for the notes: detected, else requested, else classify the transcript now (legacy meetings).
    let language: string | null = meeting.detectedLanguage ?? meeting.language ?? null;
    if (!language && meeting.segments.length) {
      language = await classifyTextLanguage(meeting.segments.map((s) => s.text).join(" "));
      if (language) await prisma.meeting.updateMany({ where: { id, detectedLanguage: null }, data: { detectedLanguage: language } });
    }
    const notes = await generateNotes(meeting.segments, language);
    await prisma.$transaction([
      prisma.meetingNotes.upsert({ where: { meetingId: id }, create: { meetingId: id, ...notes, language }, update: { ...notes, language, generatedAt: new Date() } }),
      prisma.meeting.update({ where: { id }, data: { status: "done" } }),
      // Notes changed: cached translated notes are stale, transcript translations stay valid.
      prisma.meetingTranslation.updateMany({ where: { meetingId: id }, data: { notes: Prisma.DbNull } }),
    ]);
    return { status: "done", notes, language };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Notes generation failed";
    console.error("[meeting finish]", id, message);
    await prisma.meeting.update({ where: { id }, data: { status: "failed", error: message.slice(0, 500) } });
    return { status: "failed", error: message };
  }
}

/**
 * Auto-finishes this user's meetings that are still "recording" but received no chunk (or, with no chunks, started)
 * more than STALE_MEETING_MS ago, so abandoned recordings get notes and stop accepting uploads.
 * Cheap when nothing is stale (one query). Returns the ids it finished.
 */
export async function sweepStaleMeetings(userId: string, excludeId?: string): Promise<string[]> {
  if ((await getMaintenance()).enabled) return [];
  const cutoff = new Date(Date.now() - STALE_MEETING_MS);
  const stale = await prisma.meeting.findMany({
    where: {
      userId,
      status: "recording",
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startedAt: { lt: cutoff },
      chunks: { none: { createdAt: { gte: cutoff } } },
    },
    select: { id: true },
    take: 5,
  });
  const done: string[] = [];
  for (const m of stale) {
    const r = await finalizeMeeting(m.id, { reason: "Ended automatically after 30 minutes without audio" });
    if (r.status === "done") done.push(m.id);
  }
  return done;
}
