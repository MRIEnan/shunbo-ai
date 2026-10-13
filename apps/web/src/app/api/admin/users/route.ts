import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { startOfWeek } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { admin, response } = await requireAdmin();
  if (!admin) return response;
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const take = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const users = await prisma.user.findMany({
    where: q ? { email: { contains: q, mode: "insensitive" } } : {},
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      subscription: true,
      _count: { select: { dictations: true } },
    },
  });
  const hasMore = users.length > take;
  const page = users.slice(0, take);
  const weekly = await prisma.usageRecord.groupBy({
    by: ["userId"],
    where: { userId: { in: page.map((u) => u.id) }, createdAt: { gte: startOfWeek() } },
    _sum: { words: true },
  });
  const weeklyMap = new Map(weekly.map((w) => [w.userId, w._sum.words ?? 0]));

  return NextResponse.json({
    items: page.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt.getTime(),
      plan: u.subscription?.plan ?? "free",
      status: u.subscription?.status ?? "active",
      stripeCustomerId: u.subscription?.stripeCustomerId ?? null,
      cancelAtPeriodEnd: u.subscription?.cancelAtPeriodEnd ?? false,
      dictations: u._count.dictations,
      wordsThisWeek: weeklyMap.get(u.id) ?? 0,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
