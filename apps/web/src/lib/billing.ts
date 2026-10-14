import { prisma } from "@/lib/prisma";
import type { PlanConfig } from "@prisma/client";

export type PlanDTO = {
  slug: string;
  name: string;
  description: string;
  priceMonthlyCents: number;
  currency: string;
  wordsPerWeek: number | null;
  meetingMinutesPerMonth: number | null;
  features: string[];
  cta: "checkout" | "contact" | "free";
  active: boolean;
  sortOrder: number;
  stripeProductId: string | null;
  stripePriceId: string | null;
};

export const DEFAULT_PLANS: Omit<PlanDTO, "stripeProductId" | "stripePriceId">[] = [
  {
    slug: "free",
    name: "Free",
    description: "Try Shunbo on any device.",
    priceMonthlyCents: 0,
    currency: "usd",
    wordsPerWeek: 2000,
    meetingMinutesPerMonth: 60,
    features: ["2,000 words per week", "60 meeting minutes per month", "Web and desktop dictation", "100+ languages", "Vocabulary and snippets"],
    cta: "free",
    active: true,
    sortOrder: 0,
  },
  {
    slug: "pro",
    name: "Pro",
    description: "Dictation and meeting notes for people who write all day.",
    priceMonthlyCents: 1200,
    currency: "usd",
    // Fair use (admin-editable): bounds the worst-case cost of one subscription.
    wordsPerWeek: 100_000,
    meetingMinutesPerMonth: 2400,
    features: ["100,000 words per week (fair use)", "40 hours of meetings per month (fair use)", "Everything in Free", "Style presets per app", "Priority processing"],
    cta: "checkout",
    active: true,
    sortOrder: 1,
  },
  {
    slug: "business",
    name: "Business",
    description: "For teams that need shared vocabulary and admin controls.",
    priceMonthlyCents: 0,
    currency: "usd",
    wordsPerWeek: null,
    meetingMinutesPerMonth: null,
    features: ["Everything in Pro", "Centralized billing", "Shared team vocabulary", "Admin controls and SSO", "Dedicated support"],
    cta: "contact",
    active: true,
    sortOrder: 2,
  },
];

export const toPlanDTO = (p: PlanConfig): PlanDTO => ({
  slug: p.slug,
  name: p.name,
  description: p.description ?? "",
  priceMonthlyCents: p.priceMonthlyCents,
  currency: p.currency,
  wordsPerWeek: p.wordsPerWeek,
  meetingMinutesPerMonth: p.meetingMinutesPerMonth,
  features: p.features,
  cta: (["checkout", "contact", "free"].includes(p.cta) ? p.cta : "checkout") as PlanDTO["cta"],
  active: p.active,
  sortOrder: p.sortOrder,
  stripeProductId: p.stripeProductId,
  stripePriceId: p.stripePriceId,
});

/** Ensures the default plans exist, then returns all plans ordered. */
export async function getPlans(includeInactive = false): Promise<PlanDTO[]> {
  const count = await prisma.planConfig.count();
  if (count === 0) {
    await prisma.planConfig.createMany({ data: DEFAULT_PLANS });
  }
  const rows = await prisma.planConfig.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map(toPlanDTO);
}

export async function getPlan(slug: string): Promise<PlanDTO | null> {
  const p = await prisma.planConfig.findUnique({ where: { slug } });
  return p ? toPlanDTO(p) : null;
}

export function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function getWeeklyUsage(userId: string) {
  const agg = await prisma.usageRecord.aggregate({
    where: { userId, kind: "dictation", createdAt: { gte: startOfWeek() } },
    _sum: { words: true },
  });
  return agg._sum.words ?? 0;
}

export function startOfMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Meeting minutes recorded this calendar month (UTC). */
export async function getMonthlyMeetingMinutes(userId: string) {
  const agg = await prisma.usageRecord.aggregate({
    where: { userId, kind: "meeting", createdAt: { gte: startOfMonth() } },
    _sum: { seconds: true },
  });
  return Math.round((agg._sum.seconds ?? 0) / 60);
}

export type Entitlement = {
  plan: PlanDTO;
  status: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  overLimit: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  hasStripeCustomer: boolean;
  meetingMinutesUsed: number;
  meetingMinutesLimit: number | null;
  meetingOverLimit: boolean;
};

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const [sub, plans, used, meetingMinutesUsed] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    getPlans(true),
    getWeeklyUsage(userId),
    getMonthlyMeetingMinutes(userId),
  ]);
  const activeStatuses = ["active", "trialing", "past_due"];
  const slug = sub && activeStatuses.includes(sub.status) ? sub.plan : "free";
  const plan = plans.find((p) => p.slug === slug) ?? plans.find((p) => p.slug === "free") ?? toPlanDTO({
    ...DEFAULT_PLANS[0],
    stripeProductId: null,
    stripePriceId: null,
    updatedAt: new Date(),
  } as PlanConfig);
  const limit = plan.wordsPerWeek;
  return {
    plan,
    status: slug === "free" ? "active" : (sub?.status ?? "active"),
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    overLimit: limit !== null && used >= limit,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: sub?.currentPeriodEnd?.getTime() ?? null,
    hasStripeCustomer: !!sub?.stripeCustomerId,
    meetingMinutesUsed,
    meetingMinutesLimit: plan.meetingMinutesPerMonth,
    meetingOverLimit: plan.meetingMinutesPerMonth !== null && meetingMinutesUsed >= plan.meetingMinutesPerMonth,
  };
}
