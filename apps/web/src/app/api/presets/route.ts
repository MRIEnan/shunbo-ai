import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TONES, type Tone } from "@/lib/prompts";
import { toDbTone, fromDbTone } from "@/lib/tone";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const body = await req.json().catch(() => ({}));
  const context = typeof body.context === "string" ? body.context.trim().toLowerCase().slice(0, 40) : "";
  if (!context) return NextResponse.json({ error: "context is required" }, { status: 400 });
  const tone: Tone = TONES.includes(body.tone as Tone) ? (body.tone as Tone) : "casual";
  const instructions = typeof body.instructions === "string" ? body.instructions.trim().slice(0, 500) : "";
  const p = await prisma.stylePreset.upsert({
    where: { userId_context: { userId: user.id, context } },
    create: { userId: user.id, context, tone: toDbTone(tone), instructions: instructions || null },
    update: { tone: toDbTone(tone), instructions: instructions || null },
  });
  return NextResponse.json({ item: { id: p.id, context: p.context, tone: fromDbTone(p.tone), instructions: p.instructions ?? "" } });
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await prisma.stylePreset.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
