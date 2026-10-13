"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import type { PlanDTO } from "@/lib/billing";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

type Props = { plans: PlanDTO[]; currentPlan: string | null; signedIn: boolean; compact?: boolean };

export function PlanCards({ plans, currentPlan, signedIn, compact }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkout = async (slug: string) => {
    setBusy(slug);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: slug }) });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't start checkout");
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout");
      setBusy(null);
    }
  };

  const portal = async () => {
    setBusy("portal");
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.assign(data.url);
    else {
      setError(data.error ?? "Couldn't open billing portal");
      setBusy(null);
    }
  };

  return (
    <div>
      {error && <p className="mb-4 rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm">{error}</p>}
      <div className={cn("grid gap-5", compact ? "md:grid-cols-3" : "md:grid-cols-3")}>
        {plans.map((p) => {
          const isCurrent = currentPlan === p.slug;
          const highlight = p.slug === "pro";
          return (
            <div
              key={p.slug}
              className={cn(
                "flex flex-col rounded-card border p-6 sm:p-7",
                highlight ? "border-ink bg-ink text-cream" : "border-ink/10 bg-cream-2",
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{p.name}</h2>
                {isCurrent && <span className={cn("rounded-pill px-2.5 py-1 text-[11px] font-medium", highlight ? "bg-lavender text-ink" : "bg-lavender")}>Current plan</span>}
              </div>
              <p className={cn("mt-1 text-sm", highlight ? "text-cream/70" : "text-ink/60")}>{p.description}</p>
              <div className="display mt-5 text-4xl">
                {p.cta === "contact" ? "Custom" : p.priceMonthlyCents === 0 ? "$0" : formatPrice(p.priceMonthlyCents, p.currency)}
                {p.cta !== "contact" && <span className={cn("ml-1 font-sans text-sm", highlight ? "text-cream/60" : "text-ink/60")}>/ month</span>}
              </div>
              <p className={cn("mt-1 text-xs", highlight ? "text-cream/60" : "text-ink/60")}>
                {p.wordsPerWeek ? `${p.wordsPerWeek.toLocaleString()} words per week` : "Unlimited words"}
              </p>
              <ul className="mt-5 flex flex-col gap-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={cn("mt-0.5 size-4 shrink-0", highlight ? "text-mint" : "text-forest")} /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex-1" />
              {p.cta === "contact" ? (
                <Link href="mailto:sales@shunbo.ai" className={cn("inline-flex h-11 items-center justify-center rounded-pill border text-sm font-medium", highlight ? "border-cream/30" : "border-ink/20")}>
                  Talk to sales
                </Link>
              ) : isCurrent ? (
                p.slug !== "free" ? (
                  <button type="button" onClick={portal} disabled={busy !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-pill border border-cream/30 text-sm font-medium">
                    {busy === "portal" && <Loader2 className="size-4 animate-spin" />} Manage billing
                  </button>
                ) : (
                  <span className="inline-flex h-11 items-center justify-center rounded-pill border border-ink/10 text-sm text-ink/60">Included</span>
                )
              ) : p.cta === "free" ? (
                <Link href={signedIn ? "/app" : "/signin?callbackUrl=/app"} className="inline-flex h-11 items-center justify-center rounded-pill border border-ink/20 text-sm font-medium">
                  {signedIn ? "Go to app" : "Get started free"}
                </Link>
              ) : signedIn ? (
                <button
                  type="button"
                  onClick={() => checkout(p.slug)}
                  disabled={busy !== null}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-pill border border-ink/80 bg-lavender text-sm font-medium text-ink shadow-[0_2px_0_0_rgba(26,26,26,0.8)]"
                >
                  {busy === p.slug && <Loader2 className="size-4 animate-spin" />} Upgrade to {p.name}
                </button>
              ) : (
                <Link href={`/signin?callbackUrl=/pricing`} className="inline-flex h-11 items-center justify-center rounded-pill border border-ink/80 bg-lavender text-sm font-medium text-ink shadow-[0_2px_0_0_rgba(26,26,26,0.8)]">
                  Sign in to upgrade
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
