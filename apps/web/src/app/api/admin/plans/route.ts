import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { getPlans } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET() {
  const { admin, response } = await requireAdmin();
  if (!admin) return response;
  return NextResponse.json({ items: await getPlans(true) });
}

/** Create or update a plan. Stripe price changes are applied via /api/admin/plans/sync. */
export async function PUT(req: Request) {
  const { admin, response } = await requireAdmin();
  if (!admin) return response;
  const b = await req.json().catch(() => ({}));
  const slug = typeof b.slug === "string" ? b.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") : "";
  if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim().slice(0, 60) : slug;
  const priceMonthlyCents = Number.isInteger(b.priceMonthlyCents) && b.priceMonthlyCents >= 0 ? b.priceMonthlyCents : 0;
  const wordsPerWeek = b.wordsPerWeek === null || b.wordsPerWeek === "" ? null : Number.isInteger(b.wordsPerWeek) && b.wordsPerWeek > 0 ? b.wordsPerWeek : undefined;
  const features = Array.isArray(b.features) ? b.features.filter((f: unknown): f is string => typeof f === "string").map((f: string) => f.trim()).filter(Boolean).slice(0, 12) : undefined;
  const cta = ["checkout", "contact", "free"].includes(b.cta) ? b.cta : undefined;
  const data = {
    name,
    description: typeof b.description === "string" ? b.description.slice(0, 200) : undefined,
    priceMonthlyCents,
    wordsPerWeek,
    features,
    cta,
    active: typeof b.active === "boolean" ? b.active : undefined,
    sortOrder: Number.isInteger(b.sortOrder) ? b.sortOrder : undefined,
  };
  const p = await prisma.planConfig.upsert({
    where: { slug },
    create: { slug, ...data, features: features ?? [], cta: cta ?? "checkout", wordsPerWeek: wordsPerWeek ?? null },
    update: data,
  });
  const needsSync = p.cta === "checkout" && p.priceMonthlyCents > 0 && !p.stripePriceId;
  return NextResponse.json({ item: p, needsSync });
}

export async function DELETE(req: Request) {
  const { admin, response } = await requireAdmin();
  if (!admin) return response;
  const b = await req.json().catch(() => ({}));
  const slug = typeof b.slug === "string" ? b.slug : "";
  if (!slug || slug === "free") return NextResponse.json({ error: "Cannot delete this plan" }, { status: 400 });
  const inUse = await prisma.subscription.count({ where: { plan: slug } });
  if (inUse > 0) return NextResponse.json({ error: `${inUse} subscription(s) use this plan. Deactivate it instead.` }, { status: 400 });
  await prisma.planConfig.delete({ where: { slug } });
  return NextResponse.json({ ok: true });
}
