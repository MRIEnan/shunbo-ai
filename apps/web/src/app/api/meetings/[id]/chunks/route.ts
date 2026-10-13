import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { transcribeChunk } from "@/lib/meetings";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Receives one audio chunk (multipart: audio, index, track, offsetSec, durationSec),
 * transcribes it right away and stores the segments. Audio is never persisted.
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
    const segments = await transcribeChunk({
      file: audio,
      track,
      offsetSec,
      diarize: meeting.diarize,
      language: meeting.language ?? undefined,
      vocabulary,
    });
    await prisma.$transaction([
      prisma.meetingSegment.deleteMany({ where: { meetingId: id, chunkIndex: index, track } }),
      prisma.meetingSegment.createMany({ data: segments.map((s) => ({ meetingId: id, chunkIndex: index, track, ...s })) }),
      prisma.meetingChunk.update({ where: { id: chunk.id }, data: { status: "done" } }),
      prisma.meeting.update({ where: { id }, data: { durationSec: { set: Math.max(meeting.durationSec, offsetSec + durationSec) } } }),
    ]);
    return NextResponse.json({ ok: true, segments: segments.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    console.error("[meeting chunk]", id, index, track, message);
    await prisma.meetingChunk.update({ where: { id: chunk.id }, data: { status: "failed", error: message.slice(0, 500) } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
