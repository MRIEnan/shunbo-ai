import { prisma } from "@/lib/prisma";
import { startOfWeek, getPlans } from "@/lib/billing";
import { formatPrice } from "@/lib/format";
import { getMaintenance } from "@/lib/maintenance";
import { AdminMaintenance } from "@/components/admin/AdminMaintenance";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-card border border-ink/10 bg-cream-2 p-5">
      <div className="text-xs text-ink/60">{label}</div>
      <div className="display mt-2 text-4xl">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {hint && <div className="mt-1 text-xs text-ink/60">{hint}</div>}
    </div>
  );
}

export default async function AdminOverview() {
  const since7d = daysAgo(7);
  const week = startOfWeek();
  const [users, newUsers7d, dictations, dictations7d, wordsWeek, subsByPlan, plans] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.dictation.count(),
    prisma.dictation.count({ where: { createdAt: { gte: since7d } } }),
    prisma.usageRecord.aggregate({ where: { createdAt: { gte: week } }, _sum: { words: true } }),
    prisma.subscription.groupBy({ by: ["plan", "status"], _count: true }),
    getPlans(true),
  ]);

  const paidActive = subsByPlan.filter((s) => s.plan !== "free" && ["active", "trialing", "past_due"].includes(s.status));
  const paidCount = paidActive.reduce((n, s) => n + s._count, 0);
  const mrrCents = paidActive.reduce((sum, s) => sum + s._count * (plans.find((p) => p.slug === s.plan)?.priceMonthlyCents ?? 0), 0);

  const maintenance = await getMaintenance(true);
  const recent = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { subscription: true, _count: { select: { dictations: true } } } });

  return (
    <div className="flex flex-col gap-6">
      <AdminMaintenance initial={maintenance} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={users} hint={`+${newUsers7d} in the last 7 days`} />
        <Stat label="Paid subscriptions" value={paidCount} hint={`${formatPrice(mrrCents)} MRR`} />
        <Stat label="Dictations" value={dictations} hint={`${dictations7d.toLocaleString()} in the last 7 days`} />
        <Stat label="Words this week" value={wordsWeek._sum.words ?? 0} hint="Since Monday 00:00 UTC" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-ink/10 bg-cream-2">
          <div className="border-b border-ink/10 px-5 py-3 text-sm font-medium">Subscriptions by plan</div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-ink/10">
              {plans.map((p) => {
                const rows = subsByPlan.filter((s) => s.plan === p.slug);
                const active = rows.filter((r) => ["active", "trialing"].includes(r.status)).reduce((n, r) => n + r._count, 0);
                const other = rows.reduce((n, r) => n + r._count, 0) - active;
                return (
                  <tr key={p.slug}>
                    <td className="px-5 py-3 font-medium">{p.name}{!p.active && <span className="ml-2 text-xs text-ink/60">(inactive)</span>}</td>
                    <td className="px-5 py-3 text-right">{active} active</td>
                    <td className="px-5 py-3 text-right text-ink/60">{other ? `${other} other` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-5 py-3 text-xs text-ink/60">Users without a subscription row are on Free.</p>
        </div>

        <div className="rounded-card border border-ink/10 bg-cream-2">
          <div className="border-b border-ink/10 px-5 py-3 text-sm font-medium">Newest users</div>
          <ul className="divide-y divide-ink/10 text-sm">
            {recent.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate">{u.email}</div>
                  <div className="text-xs text-ink/60">{new Date(u.createdAt).toLocaleDateString()} · {u._count.dictations} dictations</div>
                </div>
                <span className="rounded-pill bg-ink/5 px-2.5 py-1 text-xs capitalize">{u.subscription?.plan ?? "free"}</span>
              </li>
            ))}
            {recent.length === 0 && <li className="px-5 py-6 text-center text-ink/60">No users yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
