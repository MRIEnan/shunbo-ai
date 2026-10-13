import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCode } from "@/lib/codes";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Re-sends a verification or reset code. Always answers 200 for unknown emails to avoid account probing. */
export async function POST(req: Request) {
  const limited = await rateLimit(`resend:${clientKey(req)}`, 6, 10 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const purpose = b.purpose === "reset" ? "reset" : "verify";
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ ok: true });
  if (purpose === "verify" && user.emailVerified) return NextResponse.json({ ok: true, verified: true });
  try {
    await sendCode(email, purpose);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't send the code" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
