import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCode } from "@/lib/codes";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Confirms a sign-up code and marks the email verified. */
export async function POST(req: Request) {
  const limited = await rateLimit(`verify:${clientKey(req)}`, 20, 10 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const code = String(b.code ?? "").replace(/\D/g, "");
  if (!email || code.length !== 6) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  const result = await verifyCode(email, "verify", code);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  await prisma.user.updateMany({ where: { email }, data: { emailVerified: new Date() } });
  return NextResponse.json({ ok: true });
}
