import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export async function isAdminUser(userId: string, email?: string | null) {
  if (email && adminEmails().includes(email.toLowerCase())) return true;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return u?.role === "admin";
}

/** For server components: returns the admin user or null. */
export async function currentAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return (await isAdminUser(session.user.id, session.user.email)) ? session.user : null;
}

/** For API routes. */
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) return { admin: null, response: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  return { admin, response: null };
}
