import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { generateNotes, classifyTextLanguage } from "@/lib/meetings";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Ends the meeting, meters the minutes, and generates notes (in the meeting's language) from the stored segments. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  const meeting = await prisma.meeting.findFirst({ where: { id, userId: user.id }, include: { segments: { orderBy: { startSec: "asc" } } } });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const durationSec = Math.max(meeting.durationSec, typeof b.durationSec === "number" ? b.durationSec : 0);

  if (meeting.status === "recording") {
    await prisma.$transaction([
      prisma.meeting.update({ where: { id }, data: { status: "processing", endedAt: new Date(), durationSec } }),
      prisma.usageRecord.create({ data: { userId: user.id, kind: "meeting", seconds: Math.round(durationSec) } }),
    ]);
  } else if (meeting.status === "done" && !b.regenerate) {
    return NextResponse.json({ ok: true, status: "done" });
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
      prisma.meeting.update({ where: { id }, data: { status: "done", error: null } }),
      // Notes changed: cached translated notes are stale, transcript translations stay valid.
      prisma.meetingTranslation.updateMany({ where: { meetingId: id }, data: { notes: Prisma.DbNull } }),
    ]);
    return NextResponse.json({ ok: true, status: "done", notes, language });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Notes generation failed";
    console.error("[meeting finish]", id, message);
    await prisma.meeting.update({ where: { id }, data: { status: "failed", error: message.slice(0, 500) } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
