import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getStripe, appUrl } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  const { user, response } = await requireUser();
  if (!user) return response;
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account yet. Upgrade first." }, { status: 400 });
  }
  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: appUrl("/settings"),
  });
  return NextResponse.json({ url: session.url });
}
