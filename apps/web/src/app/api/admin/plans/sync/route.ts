import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Pushes a plan to Stripe: creates the product if missing, and creates a new recurring price
 * whenever the configured amount differs from the current Stripe price (prices are immutable).
 * Old prices are archived so new checkouts use the new one; existing subscribers keep theirs.
 */
export async function POST(req: Request) {
  const { admin, response } = await requireAdmin();
  if (!admin) return response;
  const b = await req.json().catch(() => ({}));
  const slug = typeof b.slug === "string" ? b.slug : "";
  const plan = await prisma.planConfig.findUnique({ where: { slug } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (plan.cta !== "checkout" || plan.priceMonthlyCents <= 0) {
    return NextResponse.json({ error: "Only paid checkout plans sync to Stripe" }, { status: 400 });
  }

  const stripe = getStripe();
  let productId = plan.stripeProductId;
  if (productId) {
    try {
      await stripe.products.update(productId, { name: `Shunbo ${plan.name}`, description: plan.description ?? undefined });
    } catch {
      productId = null;
    }
  }
  if (!productId) {
    const product = await stripe.products.create({
      name: `Shunbo ${plan.name}`,
      description: plan.description ?? undefined,
      metadata: { slug: plan.slug },
    });
    productId = product.id;
  }

  let priceId = plan.stripePriceId;
  let changed = false;
  if (priceId) {
    const existing = await stripe.prices.retrieve(priceId).catch(() => null);
    if (!existing || existing.unit_amount !== plan.priceMonthlyCents || existing.currency !== plan.currency || !existing.active) {
      if (existing?.active) await stripe.prices.update(priceId, { active: false });
      priceId = null;
    }
  }
  if (!priceId) {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: plan.priceMonthlyCents,
      currency: plan.currency,
      recurring: { interval: "month" },
      metadata: { slug: plan.slug },
    });
    priceId = price.id;
    changed = true;
  }

  const updated = await prisma.planConfig.update({
    where: { slug },
    data: { stripeProductId: productId, stripePriceId: priceId },
  });
  return NextResponse.json({ item: updated, changed });
}
