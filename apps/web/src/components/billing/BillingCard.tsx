"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  planName: string;
  planSlug: string;
  status: string;
  used: number;
  limit: number | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  hasStripeCustomer: boolean;
  justUpgraded?: boolean;
};

export function BillingCard(p: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pct = p.limit ? Math.min(100, Math.round((p.used / p.limit) * 100)) : 0;

  const portal = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.assign(data.url);
    else {
      setError(data.error ?? "Couldn't open billing portal");
      setBusy(false);
    }
  };

  return (
    <section className="rounded-card border border-ink/10 bg-cream-2 p-6">
      <h2 className="text-base font-semibold">Plan and usage</h2>
      {p.justUpgraded && (
        <p className="mt-3 rounded-xl bg-lavender p-3 text-sm">Thanks for upgrading! Your plan is being activated. Refresh in a moment if it hasn&rsquo;t updated yet.</p>
      )}
      {error && <p className="mt-3 rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-ink px-3 py-1 text-xs font-medium text-cream">{p.planName}</span>
        <span className={cn("text-xs", p.status === "active" || p.status === "trialing" ? "text-forest" : "text-coral")}>
          {p.status === "past_due" ? "Payment past due" : p.status === "trialing" ? "Trial" : p.status === "active" ? "Active" : p.status}
        </span>
        {p.cancelAtPeriodEnd && p.currentPeriodEnd && (
          <span className="text-xs text-ink/60">Cancels on {new Date(p.currentPeriodEnd).toLocaleDateString()}</span>
        )}
        {!p.cancelAtPeriodEnd && p.currentPeriodEnd && p.planSlug !== "free" && (
          <span className="text-xs text-ink/60">Renews {new Date(p.currentPeriodEnd).toLocaleDateString()}</span>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-sm">
          <span>Words this week</span>
          <span className="text-ink/60">
            {p.used.toLocaleString()} {p.limit ? `/ ${p.limit.toLocaleString()}` : "· unlimited"}
          </span>
        </div>
        {p.limit && (
          <div className="mt-2 h-2 overflow-hidden rounded-pill bg-ink/10">
            <div className={cn("h-full rounded-pill transition-all", pct >= 90 ? "bg-coral" : "bg-forest")} style={{ width: `${pct}%` }} />
          </div>
        )}
        <p className="mt-1.5 text-xs text-ink/60">Resets every Monday.</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {p.planSlug === "free" ? (
          <Link href="/pricing" className="inline-flex h-10 items-center rounded-pill border border-ink/80 bg-lavender px-4 text-sm font-medium shadow-[0_2px_0_0_rgba(26,26,26,0.8)]">
            Upgrade to Pro
          </Link>
        ) : null}
        {p.hasStripeCustomer && (
          <button type="button" onClick={portal} disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-ink/20 px-4 text-sm">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />} Manage billing
          </button>
        )}
        <Link href="/pricing" className="inline-flex h-10 items-center rounded-pill px-3 text-sm text-ink/60 hover:text-ink">
          Compare plans
        </Link>
      </div>
    </section>
  );
}
