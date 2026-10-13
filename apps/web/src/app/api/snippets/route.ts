import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;
  const items = await prisma.snippet.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ items: items.map((s) => ({ id: s.id, trigger: s.trigger, expansion: s.expansion })) });
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const body = await req.json().catch(() => ({}));
  const trigger = typeof body.trigger === "string" ? body.trigger.trim().slice(0, 80) : "";
  const expansion = typeof body.expansion === "string" ? body.expansion.trim().slice(0, 2000) : "";
  if (!trigger || !expansion) return NextResponse.json({ error: "trigger and expansion are required" }, { status: 400 });
  const count = await prisma.snippet.count({ where: { userId: user.id } });
  if (count >= 200) return NextResponse.json({ error: "Snippet limit reached (200)" }, { status: 400 });
  const s = await prisma.snippet.upsert({
    where: { userId_trigger: { userId: user.id, trigger } },
    create: { userId: user.id, trigger, expansion },
    update: { expansion },
  });
  return NextResponse.json({ item: { id: s.id, trigger: s.trigger, expansion: s.expansion } });
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await prisma.snippet.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
