import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getEntitlement } from "@/lib/billing";

export const runtime = "nodejs";

/** Used by the desktop app to validate its token and show account state. */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;
  const e = await getEntitlement(user.id);
  return NextResponse.json({
    user: { id: user.id, email: user.email },
    plan: { slug: e.plan.slug, name: e.plan.name },
    used: e.used,
    limit: e.limit,
    overLimit: e.overLimit,
  });
}
