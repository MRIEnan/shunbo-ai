import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { generateNotes } from "@/lib/meetings";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Ends the meeting, meters the minutes, and generates notes from the stored segments. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  const meeting = await prisma.meeting.findFirst({ where: { id, userId: user.id }, include: { segments: true } });
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
    const notes = await generateNotes(meeting.segments);
    await prisma.$transaction([
      prisma.meetingNotes.upsert({ where: { meetingId: id }, create: { meetingId: id, ...notes }, update: { ...notes, generatedAt: new Date() } }),
      prisma.meeting.update({ where: { id }, data: { status: "done", error: null } }),
    ]);
    return NextResponse.json({ ok: true, status: "done", notes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Notes generation failed";
    console.error("[meeting finish]", id, message);
    await prisma.meeting.update({ where: { id }, data: { status: "failed", error: message.slice(0, 500) } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
