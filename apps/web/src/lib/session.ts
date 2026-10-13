import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SessionUser = { id: string; email?: string | null; name?: string | null };

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a long-lived desktop token. Returns the plaintext once; only the hash is stored. */
export async function createApiToken(userId: string, name = "Desktop") {
  const token = `shb_${randomBytes(32).toString("base64url")}`;
  await prisma.apiToken.create({ data: { userId, tokenHash: hashToken(token), name } });
  return token;
}

async function userFromBearer(): Promise<SessionUser | null> {
  const h = await headers();
  const authz = h.get("authorization");
  if (!authz?.startsWith("Bearer ")) return null;
  const token = authz.slice(7).trim();
  if (!token.startsWith("shb_")) return null;
  const row = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!row || row.revokedAt) return null;
  // Throttle lastUsedAt writes to once a minute.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return { id: row.user.id, email: row.user.email, name: row.user.name };
}

/** Session cookie (web) or bearer token (desktop). */
export async function currentUser(): Promise<SessionUser | null> {
  const bearer = await userFromBearer();
  if (bearer) return bearer;
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

/** For API routes: returns the user or a 401 response. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  }
  return { user, response: null };
}
