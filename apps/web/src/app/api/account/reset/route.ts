import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyCode } from "@/lib/codes";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Sets a new password after a valid reset code. Also signs the user's desktop tokens out. */
export async function POST(req: Request) {
  const limited = await rateLimit(`reset:${clientKey(req)}`, 20, 10 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const code = String(b.code ?? "").replace(/\D/g, "");
  const password = String(b.password ?? "");
  if (!email || code.length !== 6) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
  const result = await verifyCode(email, "reset", code);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hash(password, 12), emailVerified: user.emailVerified ?? new Date() } }),
    prisma.apiToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true });
}
