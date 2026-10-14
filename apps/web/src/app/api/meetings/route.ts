import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getEntitlement } from "@/lib/billing";
import { sweepStaleMeetings } from "@/lib/meeting-finish";
import { maintenanceGuard } from "@/lib/maintenance";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  // Abandoned recordings (no chunk for 30 minutes) are finished here so they get notes and stop accepting uploads.
  await sweepStaleMeetings(user.id).catch((e) => console.warn("[meeting sweep]", e instanceof Error ? e.message : e));
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const take = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const rows = await prisma.meeting.findMany({
    where: {
      userId: user.id,
      ...(q
        ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { notes: { summary: { contains: q, mode: "insensitive" } } }, { segments: { some: { text: { contains: q, mode: "insensitive" } } } }] }
        : {}),
    },
    orderBy: { startedAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { notes: { select: { summary: true } } },
  });
  const hasMore = rows.length > take;
  const items = rows.slice(0, take).map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
    source: m.source,
    durationSec: m.durationSec,
    startedAt: m.startedAt.getTime(),
    summary: m.notes?.summary ?? null,
    language: m.detectedLanguage ?? m.language ?? null,
    languages: m.languages,
  }));
  return NextResponse.json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
}

/** Starts a meeting. Returns 402 when the monthly minute allowance is used up. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  // AI paused from the admin dashboard: refuse before any OpenAI call.
  const paused = await maintenanceGuard();
  if (paused) return paused;
  const e = await getEntitlement(user.id);
  if (e.meetingOverLimit) {
    return NextResponse.json(
      { error: `You've used your ${e.meetingMinutesLimit} meeting minutes this month. Upgrade for unlimited Notetaker.`, code: "quota_exceeded", used: e.meetingMinutesUsed, limit: e.meetingMinutesLimit },
      { status: 402 },
    );
  }
  const b = await req.json().catch(() => ({}));
  const title = typeof b.title === "string" && b.title.trim() ? b.title.trim().slice(0, 120) : `Meeting ${new Date().toLocaleString()}`;
  const m = await prisma.meeting.create({
    data: {
      userId: user.id,
      title,
      source: b.source === "web" ? "web" : "desktop",
      language: typeof b.language === "string" && b.language !== "auto" ? b.language : null,
      // An explicit choice is also the "detected" language, so the badge shows immediately.
      detectedLanguage: typeof b.language === "string" && b.language !== "auto" ? b.language : null,
      diarize: b.diarize !== false,
    },
  });
  return NextResponse.json({
    item: { id: m.id, title: m.title, status: m.status, startedAt: m.startedAt.getTime() },
    remainingMinutes: e.meetingMinutesLimit === null ? null : Math.max(0, e.meetingMinutesLimit - e.meetingMinutesUsed),
  });
}
