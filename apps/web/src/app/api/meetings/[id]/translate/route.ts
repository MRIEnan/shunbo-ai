import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { isSupportedLanguage } from "@/lib/languages";
import { classifyTextLanguage, type Notes, type TranslationDTO } from "@/lib/meetings";
import { translateSegments, translateNotes, TRANSLATE_MODEL } from "@/lib/translate";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_TARGETS = 5;

const toDTO = (t: { targetLang: string; sourceLang: string | null; segments: unknown; notes: unknown; createdAt: Date; updatedAt: Date; model: string }): TranslationDTO => ({
  targetLang: t.targetLang,
  sourceLang: t.sourceLang,
  segments: (t.segments ?? {}) as Record<string, string>,
  notes: (t.notes as Notes | null) ?? null,
  createdAt: t.createdAt.getTime(),
  updatedAt: t.updatedAt.getTime(),
  model: t.model,
});

/**
 * Translates a finished meeting (transcript + notes) into `target` and caches it per target language.
 * Body: { target: "en", force?: boolean }. Returns { translation, cached }.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const limited = await rateLimit(`translate:${user.id}`, 10, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many translation requests. Try again in a minute." }, { status: 429 });

  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const target = b.target;
  if (!isSupportedLanguage(target)) return NextResponse.json({ error: "Unsupported target language" }, { status: 400 });

  const meeting = await prisma.meeting.findFirst({
    where: { id, userId: user.id },
    include: { notes: true, segments: { orderBy: { startSec: "asc" } }, translations: true },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (meeting.status !== "done") return NextResponse.json({ error: "Meeting is still processing" }, { status: 409 });

  // Legacy meetings: detect the language lazily from the transcript and persist it.
  let source: string | null = meeting.detectedLanguage ?? meeting.language ?? null;
  if (!source && meeting.segments.length) {
    source = await classifyTextLanguage(meeting.segments.map((s) => s.text).join(" "));
    if (source) await prisma.meeting.updateMany({ where: { id, detectedLanguage: null }, data: { detectedLanguage: source } });
  }
  if (source === target) return NextResponse.json({ error: "The meeting is already in that language" }, { status: 400 });

  const existing = meeting.translations.find((t) => t.targetLang === target);
  const notesNeeded = !!meeting.notes;
  if (existing && !b.force && (!notesNeeded || existing.notes !== null)) {
    return NextResponse.json({ translation: toDTO(existing), cached: true });
  }
  if (!existing && meeting.translations.length >= MAX_TARGETS) {
    return NextResponse.json({ error: `Up to ${MAX_TARGETS} translations per meeting. Delete one from the menu first.` }, { status: 409 });
  }

  try {
    const notesSrc: Notes | null = meeting.notes
      ? { summary: meeting.notes.summary, actionItems: meeting.notes.actionItems, decisions: meeting.notes.decisions, questions: meeting.notes.questions }
      : null;

    let segmentsMap: Record<string, string>;
    if (existing && !b.force) {
      segmentsMap = (existing.segments ?? {}) as Record<string, string>; // only notes are missing
    } else {
      segmentsMap = await translateSegments(meeting.segments.map((s) => ({ id: s.id, text: s.text, language: s.language })), source, target);
    }
    const notes = notesSrc ? await translateNotes(notesSrc, meeting.notes?.language ?? source, target) : null;

    const row = await prisma.meetingTranslation.upsert({
      where: { meetingId_targetLang: { meetingId: id, targetLang: target } },
      create: { meetingId: id, targetLang: target, sourceLang: source, segments: segmentsMap, notes: notes ?? Prisma.DbNull, model: TRANSLATE_MODEL },
      update: { sourceLang: source, segments: segmentsMap, notes: notes ?? Prisma.DbNull, model: TRANSLATE_MODEL },
    });
    return NextResponse.json({ translation: toDTO(row), cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Translation failed";
    console.error("[meeting translate]", id, target, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Removes one cached translation. Body: { target }. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (!isSupportedLanguage(b.target)) return NextResponse.json({ error: "Unsupported target language" }, { status: 400 });
  const owned = await prisma.meeting.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.meetingTranslation.deleteMany({ where: { meetingId: id, targetLang: b.target } });
  return NextResponse.json({ ok: true });
}
