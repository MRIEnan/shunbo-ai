import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { transcribeChunk, detectLanguageFromAudio } from "@/lib/meetings";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Receives one audio chunk (multipart: audio, index, track, offsetSec, durationSec),
 * transcribes it right away in the meeting's language and stores the segments. Audio is never persisted.
 * When the meeting is on "auto" and nothing has been detected yet, the first chunk with speech decides.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  const meeting = await prisma.meeting.findFirst({ where: { id, userId: user.id } });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (meeting.status !== "recording") return NextResponse.json({ error: "Meeting is no longer recording" }, { status: 409 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "No audio provided" }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "Chunk too large (max 25MB)" }, { status: 413 });
  const index = Number(form.get("index") ?? 0);
  const track = form.get("track") === "system" ? "system" : "mic";
  const offsetSec = Number(form.get("offsetSec") ?? 0);
  const durationSec = Number(form.get("durationSec") ?? 0);

  const chunk = await prisma.meetingChunk.upsert({
    where: { meetingId_index_track: { meetingId: id, index, track } },
    create: { meetingId: id, index, track, durationSec },
    update: { durationSec, status: "pending", error: null },
  });

  const vocabulary = (await prisma.vocabularyWord.findMany({ where: { userId: user.id }, select: { word: true } })).map((w) => w.word);

  try {
    // Explicit meeting language: trust it. Otherwise detect per chunk, so a chunk spoken in another language
    // (e.g. an English reply inside a Bangla meeting) is transcribed in its own language, not forced into the first one.
    let hint: string | null = meeting.language ?? null;
    if (!hint) {
      const det = await detectLanguageFromAudio(audio);
      if (det.text.length < 20) {
        // Silence or noise: keep waiting for a chunk with speech; store what little there is.
        const who = track === "mic" ? "You" : "Others";
        const segs = (det.segments ?? []).filter((s) => s.text.trim()).map((s) => ({ meetingId: id, chunkIndex: index, track, speaker: who, startSec: offsetSec + s.start, endSec: offsetSec + s.end, text: s.text.trim(), language: null as string | null }));
        await prisma.$transaction([
          prisma.meetingSegment.deleteMany({ where: { meetingId: id, chunkIndex: index, track } }),
          ...(segs.length ? [prisma.meetingSegment.createMany({ data: segs })] : []),
          prisma.meetingChunk.update({ where: { id: chunk.id }, data: { status: "done" } }),
          prisma.meeting.update({ where: { id }, data: { durationSec: { set: Math.max(meeting.durationSec, offsetSec + durationSec) } } }),
        ]);
        return NextResponse.json({ ok: true, segments: segs.length, language: null });
      }
      hint = det.code;
      // The first chunk with speech sets the meeting's dominant language (first writer wins when mic/system race).
      if (hint) await prisma.meeting.updateMany({ where: { id, detectedLanguage: null }, data: { detectedLanguage: hint } });
      if (!hint) {
        const fresh = await prisma.meeting.findUnique({ where: { id }, select: { detectedLanguage: true } });
        hint = fresh?.detectedLanguage ?? null;
      }
    }

    const { segments, language } = await transcribeChunk({ file: audio, track, offsetSec, durationSec, diarize: meeting.diarize, language: hint, vocabulary });
    await prisma.$transaction([
      prisma.meetingSegment.deleteMany({ where: { meetingId: id, chunkIndex: index, track } }),
      prisma.meetingSegment.createMany({ data: segments.map((s) => ({ meetingId: id, chunkIndex: index, track, speaker: s.speaker, startSec: s.startSec, endSec: s.endSec, text: s.text, language: s.language ?? null })) }),
      prisma.meetingChunk.update({ where: { id: chunk.id }, data: { status: "done" } }),
      prisma.meeting.update({ where: { id }, data: { durationSec: { set: Math.max(meeting.durationSec, offsetSec + durationSec) } } }),
      ...(language
        ? [prisma.$executeRaw(Prisma.sql`UPDATE "Meeting" SET "languages" = (SELECT ARRAY(SELECT DISTINCT x FROM unnest(array_append("languages", ${language})) AS x)) WHERE "id" = ${id}`)]
        : []),
    ]);
    return NextResponse.json({ ok: true, segments: segments.length, language });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    console.error("[meeting chunk]", id, index, track, message);
    await prisma.meetingChunk.update({ where: { id: chunk.id }, data: { status: "failed", error: message.slice(0, 500) } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
