import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getStripe, appUrl } from "@/lib/stripe";
import { getPlan } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const body = await req.json().catch(() => ({}));
  const slug = typeof body.plan === "string" ? body.plan : "pro";
  const plan = await getPlan(slug);
  if (!plan || !plan.active || plan.cta !== "checkout") {
    return NextResponse.json({ error: "That plan isn't available for checkout" }, { status: 400 });
  }
  if (!plan.stripePriceId) {
    return NextResponse.json({ error: "This plan hasn't been synced to Stripe yet. Ask an admin to sync it." }, { status: 503 });
  }

  const stripe = getStripe();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, include: { subscription: true } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let customerId = dbUser.subscription?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: dbUser.email, metadata: { userId: dbUser.id } });
    customerId = customer.id;
    await prisma.subscription.upsert({
      where: { userId: dbUser.id },
      create: { userId: dbUser.id, stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: appUrl("/settings?billing=success"),
    cancel_url: appUrl("/pricing?billing=cancelled"),
    allow_promotion_codes: true,
    client_reference_id: dbUser.id,
    subscription_data: { metadata: { userId: dbUser.id, plan: plan.slug } },
    metadata: { userId: dbUser.id, plan: plan.slug },
  });

  return NextResponse.json({ url: session.url });
}
