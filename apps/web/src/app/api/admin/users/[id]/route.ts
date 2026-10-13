import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";

/** Admin overrides: role, or a manual plan assignment (comped accounts, business deals). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin();
  if (!admin) return response;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (b.role === "admin" || b.role === "user") {
    if (id === admin.id && b.role === "user") {
      return NextResponse.json({ error: "You can't remove your own admin role" }, { status: 400 });
    }
    await prisma.user.update({ where: { id }, data: { role: b.role } });
  }

  if (typeof b.plan === "string") {
    const plan = await prisma.planConfig.findUnique({ where: { slug: b.plan } });
    if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    await prisma.subscription.upsert({
      where: { userId: id },
      create: { userId: id, plan: plan.slug, status: "active" },
      update: { plan: plan.slug, status: "active" },
    });
  }

  const updated = await prisma.user.findUnique({ where: { id }, include: { subscription: true } });
  return NextResponse.json({
    item: { id, email: updated!.email, role: updated!.role, plan: updated!.subscription?.plan ?? "free", status: updated!.subscription?.status ?? "active" },
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin();
  if (!admin) return response;
  const { id } = await params;
  if (id === admin.id) return NextResponse.json({ error: "You can't delete yourself" }, { status: 400 });
  await prisma.user.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
