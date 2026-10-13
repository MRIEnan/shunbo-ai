import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getEntitlement } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;
  const e = await getEntitlement(user.id);
  return NextResponse.json({
    plan: { slug: e.plan.slug, name: e.plan.name },
    status: e.status,
    used: e.used,
    limit: e.limit,
    remaining: e.remaining,
    overLimit: e.overLimit,
    cancelAtPeriodEnd: e.cancelAtPeriodEnd,
    currentPeriodEnd: e.currentPeriodEnd,
    hasStripeCustomer: e.hasStripeCustomer,
  });
}
