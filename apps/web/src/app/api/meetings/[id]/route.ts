import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  const m = await prisma.meeting.findFirst({
    where: { id, userId: user.id },
    include: { notes: true, segments: { orderBy: { startSec: "asc" } }, chunks: { select: { index: true, track: true, status: true, error: true } } },
  });
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    item: {
      id: m.id,
      title: m.title,
      status: m.status,
      source: m.source,
      durationSec: m.durationSec,
      startedAt: m.startedAt.getTime(),
      endedAt: m.endedAt?.getTime() ?? null,
      error: m.error,
      notes: m.notes
        ? { summary: m.notes.summary, actionItems: m.notes.actionItems, decisions: m.notes.decisions, questions: m.notes.questions }
        : null,
      segments: m.segments.map((s) => ({ id: s.id, speaker: s.speaker, track: s.track, startSec: s.startSec, endSec: s.endSec, text: s.text })),
      chunks: m.chunks,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 120) : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  const { count } = await prisma.meeting.updateMany({ where: { id, userId: user.id }, data: { title } });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  const { count } = await prisma.meeting.deleteMany({ where: { id, userId: user.id } });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
