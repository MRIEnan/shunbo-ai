import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HistoryList } from "@/components/app/HistoryList";
import { fromDbTone } from "@/lib/tone";

export const metadata: Metadata = { title: "History | Shunbo" };

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/history");

  const [rows, stats] = await Promise.all([
    prisma.dictation.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.dictation.aggregate({ where: { userId: session.user.id }, _count: true, _sum: { wordCount: true, durationSec: true } }),
  ]);

  const items = rows.map((d) => ({
    id: d.id,
    raw: d.raw,
    clean: d.clean,
    tone: fromDbTone(d.tone),
    durationSec: d.durationSec,
    createdAt: d.createdAt.getTime(),
    detectedLanguage: d.detectedLanguage,
  }));

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-ink/60">Your dictations</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">History</h1>
        </div>
        <dl className="flex gap-6 text-sm">
          <div>
            <dt className="text-ink/60">Dictations</dt>
            <dd className="display text-3xl">{stats._count}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Words</dt>
            <dd className="display text-3xl">{(stats._sum.wordCount ?? 0).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-ink/60">Minutes spoken</dt>
            <dd className="display text-3xl">{Math.round((stats._sum.durationSec ?? 0) / 60)}</dd>
          </div>
        </dl>
      </div>
      <HistoryList initial={items} initialCursor={rows.length === 50 ? rows[rows.length - 1].id : null} />
    </>
  );
}
