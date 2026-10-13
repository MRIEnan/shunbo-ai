import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendCode } from "@/lib/codes";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const limited = await rateLimit(`signup:${clientKey(req)}`, 10, 10 * 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash && existing.emailVerified) {
    return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
  }
  const passwordHash = await hash(password, 12);
  if (existing) {
    // Magic-link user setting a password, or an unverified sign-up retrying: update the hash, keep verification state.
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
  } else {
    await prisma.user.create({ data: { email, passwordHash } });
  }
  if (existing?.emailVerified) {
    return NextResponse.json({ ok: true, verified: true });
  }
  try {
    await sendCode(email, "verify");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't send the code" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, verified: false });
}
