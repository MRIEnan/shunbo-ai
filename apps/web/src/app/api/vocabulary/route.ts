import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;
  const words = await prisma.vocabularyWord.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ items: words.map((w) => ({ id: w.id, word: w.word })) });
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const body = await req.json().catch(() => ({}));
  const word = typeof body.word === "string" ? body.word.trim().slice(0, 80) : "";
  if (!word) return NextResponse.json({ error: "word is required" }, { status: 400 });
  const count = await prisma.vocabularyWord.count({ where: { userId: user.id } });
  if (count >= 500) return NextResponse.json({ error: "Vocabulary limit reached (500)" }, { status: 400 });
  const w = await prisma.vocabularyWord.upsert({
    where: { userId_word: { userId: user.id, word } },
    create: { userId: user.id, word },
    update: {},
  });
  return NextResponse.json({ item: { id: w.id, word: w.word } });
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await prisma.vocabularyWord.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
