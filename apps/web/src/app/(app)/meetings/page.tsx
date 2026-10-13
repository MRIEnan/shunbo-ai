import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/billing";
import { MeetingList } from "@/components/meetings/MeetingList";

export const metadata: Metadata = { title: "Meetings | Shunbo" };

export default async function MeetingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/meetings");
  const userId = session.user.id;
  const [rows, ent] = await Promise.all([
    prisma.meeting.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take: 50, include: { notes: { select: { summary: true } } } }),
    getEntitlement(userId),
  ]);
  const items = rows.map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
    source: m.source,
    durationSec: m.durationSec,
    startedAt: m.startedAt.getTime(),
    summary: m.notes?.summary ?? null,
  }));

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-ink/60">Notetaker</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">Meetings</h1>
          <p className="mt-2 text-sm text-ink/60">
            {ent.meetingMinutesLimit === null
              ? `${ent.meetingMinutesUsed} minutes recorded this month · unlimited on ${ent.plan.name}`
              : `${ent.meetingMinutesUsed} of ${ent.meetingMinutesLimit} meeting minutes used this month`}
            {ent.meetingMinutesLimit !== null && (
              <>
                {" · "}
                <Link href="/pricing" className="underline">Upgrade</Link>
              </>
            )}
          </p>
        </div>
        <Link href="/meetings/new" className="inline-flex h-10 items-center gap-2 rounded-pill border border-ink/80 bg-lavender px-4 text-sm font-medium shadow-[0_2px_0_0_rgba(26,26,26,0.8)]">
          <Plus className="size-4" /> Record in browser
        </Link>
      </div>
      <MeetingList initial={items} initialCursor={rows.length === 50 ? rows[rows.length - 1].id : null} />
    </>
  );
}
