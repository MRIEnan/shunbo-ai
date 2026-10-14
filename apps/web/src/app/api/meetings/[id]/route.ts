import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isSupportedLanguage } from "@/lib/languages";
import type { Notes } from "@/lib/meetings";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  const m = await prisma.meeting.findFirst({
    where: { id, userId: user.id },
    include: {
      notes: true,
      segments: { orderBy: { startSec: "asc" } },
      chunks: { select: { index: true, track: true, status: true, error: true } },
      translations: { orderBy: { createdAt: "asc" } },
    },
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
      language: m.language,
      detectedLanguage: m.detectedLanguage,
      languages: m.languages,
      notes: m.notes
        ? { summary: m.notes.summary, actionItems: m.notes.actionItems, decisions: m.notes.decisions, questions: m.notes.questions, language: m.notes.language }
        : null,
      segments: m.segments.map((s) => ({ id: s.id, speaker: s.speaker, track: s.track, startSec: s.startSec, endSec: s.endSec, text: s.text, language: s.language })),
      chunks: m.chunks,
      translations: m.translations.map((t) => ({
        targetLang: t.targetLang,
        sourceLang: t.sourceLang,
        segments: (t.segments ?? {}) as Record<string, string>,
        notes: (t.notes as Notes | null) ?? null,
        createdAt: t.createdAt.getTime(),
        updatedAt: t.updatedAt.getTime(),
        model: t.model,
      })),
    },
  });
}

/** Rename, or manually override the detected language (which invalidates cached translations). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const owned = await prisma.meeting.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: { title?: string; detectedLanguage?: string } = {};
  if (typeof b.title === "string") {
    const title = b.title.trim().slice(0, 120);
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
    data.title = title;
  }
  if (b.detectedLanguage !== undefined) {
    if (!isSupportedLanguage(b.detectedLanguage)) return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
    data.detectedLanguage = b.detectedLanguage;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  await prisma.$transaction([
    prisma.meeting.update({ where: { id }, data }),
    ...(data.detectedLanguage ? [prisma.meetingTranslation.deleteMany({ where: { meetingId: id } })] : []),
  ]);
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
