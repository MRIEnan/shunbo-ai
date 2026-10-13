import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TONES, type Tone } from "@/lib/prompts";
import { toDbTone, fromDbTone } from "@/lib/tone";

export const runtime = "nodejs";

/** Returns everything the dictation client needs in one round trip. */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;
  const [settings, vocabulary, snippets, presets] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    prisma.vocabularyWord.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.snippet.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.stylePreset.findMany({ where: { userId: user.id }, orderBy: { context: "asc" } }),
  ]);
  return NextResponse.json({
    settings: {
      tone: settings ? fromDbTone(settings.tone) : "casual",
      language: settings?.language ?? "auto",
      autoCopy: settings?.autoCopy ?? true,
    },
    vocabulary: vocabulary.map((w) => ({ id: w.id, word: w.word })),
    snippets: snippets.map((s) => ({ id: s.id, trigger: s.trigger, expansion: s.expansion })),
    presets: presets.map((p) => ({ id: p.id, context: p.context, tone: fromDbTone(p.tone), instructions: p.instructions ?? "" })),
  });
}

export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const body = await req.json().catch(() => ({}));
  const data: { tone?: ReturnType<typeof toDbTone>; language?: string; autoCopy?: boolean } = {};
  if (TONES.includes(body.tone as Tone)) data.tone = toDbTone(body.tone as Tone);
  if (typeof body.language === "string" && /^[a-z]{2,5}$/i.test(body.language)) data.language = body.language;
  if (typeof body.autoCopy === "boolean") data.autoCopy = body.autoCopy;
  const s = await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  return NextResponse.json({ settings: { tone: fromDbTone(s.tone), language: s.language, autoCopy: s.autoCopy } });
}
