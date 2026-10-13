import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser, hashToken } from "@/lib/session";

export const runtime = "nodejs";

/** Lists the caller's desktop tokens (never the secrets). */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;
  const items = await prisma.apiToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
  });
  return NextResponse.json({ items });
}

/** Revokes a token: by id in the body, or the bearer token making the call (desktop sign-out). */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const body = await req.json().catch(() => ({}));
  if (typeof body.id === "string") {
    await prisma.apiToken.updateMany({ where: { id: body.id, userId: user.id }, data: { revokedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  const authz = (await headers()).get("authorization");
  if (authz?.startsWith("Bearer ")) {
    await prisma.apiToken.updateMany({ where: { tokenHash: hashToken(authz.slice(7).trim()), userId: user.id }, data: { revokedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nothing to revoke" }, { status: 400 });
}
