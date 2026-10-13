import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

async function planSlugForPrice(priceId: string | null | undefined, fallback?: string) {
  if (priceId) {
    const p = await prisma.planConfig.findFirst({ where: { stripePriceId: priceId } });
    if (p) return p.slug;
  }
  return fallback ?? "pro";
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  // Stripe API 2025+ moved current_period_end to subscription items.
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const ts = item?.current_period_end ?? legacy;
  return ts ? new Date(ts * 1000) : null;
}

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId =
    sub.metadata?.userId ??
    (await prisma.subscription.findUnique({ where: { stripeCustomerId: customerId } }))?.userId ??
    null;
  if (!userId) {
    console.warn("[stripe] subscription for unknown customer", customerId);
    return;
  }
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const slug = await planSlugForPrice(priceId, sub.metadata?.plan);
  const ended = sub.status === "canceled" || sub.status === "incomplete_expired" || sub.status === "unpaid";

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: ended ? "free" : slug,
      status: sub.status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      currentPeriodEnd: periodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    update: {
      plan: ended ? "free" : slug,
      status: sub.status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: ended ? null : sub.id,
      stripePriceId: ended ? null : priceId,
      currentPeriodEnd: periodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not set" }, { status: 500 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${err instanceof Error ? err.message : "unknown"}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await getStripe().subscriptions.retrieve(subId);
          if (!sub.metadata?.userId && session.client_reference_id) {
            sub.metadata = { ...sub.metadata, userId: session.client_reference_id };
          }
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook]", event.type, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
