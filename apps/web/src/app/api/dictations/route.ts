import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TONES, type Tone } from "@/lib/prompts";
import { toDbTone, fromDbTone, countWords } from "@/lib/tone";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const take = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const rows = await prisma.dictation.findMany({
    where: {
      userId: user.id,
      ...(q ? { OR: [{ clean: { contains: q, mode: "insensitive" } }, { raw: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = rows.slice(0, take).map((d) => ({
    id: d.id,
    raw: d.raw,
    clean: d.clean,
    tone: fromDbTone(d.tone),
    durationSec: d.durationSec,
    createdAt: d.createdAt.getTime(),
  }));
  return NextResponse.json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  let body: { raw?: unknown; clean?: unknown; tone?: unknown; durationSec?: unknown; language?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }
  const raw = typeof body.raw === "string" ? body.raw : "";
  const clean = typeof body.clean === "string" ? body.clean : "";
  if (!raw.trim() || !clean.trim()) return NextResponse.json({ error: "raw and clean are required" }, { status: 400 });
  const tone: Tone = TONES.includes(body.tone as Tone) ? (body.tone as Tone) : "casual";
  const words = countWords(clean);

  const [d] = await prisma.$transaction([
    prisma.dictation.create({
      data: {
        userId: user.id,
        raw: raw.slice(0, 20_000),
        clean: clean.slice(0, 20_000),
        tone: toDbTone(tone),
        language: typeof body.language === "string" ? body.language : null,
        durationSec: typeof body.durationSec === "number" ? body.durationSec : 0,
        wordCount: words,
        source: body.source === "desktop" ? "desktop" : "web",
      },
    }),
    prisma.usageRecord.create({ data: { userId: user.id, words } }),
  ]);
  return NextResponse.json({
    item: { id: d.id, raw: d.raw, clean: d.clean, tone, durationSec: d.durationSec, createdAt: d.createdAt.getTime() },
  });
}

export async function DELETE() {
  const { user, response } = await requireUser();
  if (!user) return response;
  await prisma.dictation.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
