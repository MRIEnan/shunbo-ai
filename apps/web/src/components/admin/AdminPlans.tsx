"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Save, Plus, Trash2, Check, AlertTriangle } from "lucide-react";
import type { PlanDTO } from "@/lib/billing";
import { cn } from "@/lib/cn";

type Props = { initial: PlanDTO[]; stripeConfigured: boolean };

type Draft = {
  slug: string;
  name: string;
  description: string;
  priceDollars: string;
  wordsPerWeek: string; // "" = unlimited
  meetingMinutes: string; // "" = unlimited
  features: string; // newline separated
  cta: PlanDTO["cta"];
  active: boolean;
  sortOrder: number;
  stripePriceId: string | null;
  stripeProductId: string | null;
  isNew?: boolean;
};

const toDraft = (p: PlanDTO): Draft => ({
  slug: p.slug,
  name: p.name,
  description: p.description,
  priceDollars: (p.priceMonthlyCents / 100).toFixed(2),
  wordsPerWeek: p.wordsPerWeek === null ? "" : String(p.wordsPerWeek),
  meetingMinutes: p.meetingMinutesPerMonth === null ? "" : String(p.meetingMinutesPerMonth),
  features: p.features.join("\n"),
  cta: p.cta,
  active: p.active,
  sortOrder: p.sortOrder,
  stripePriceId: p.stripePriceId,
  stripeProductId: p.stripeProductId,
});

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1 text-xs text-ink/60", className)}>
      {label}
      {children}
    </label>
  );
}

const input = "h-9 rounded-lg border border-ink/15 bg-cream px-2.5 text-sm text-ink";

export function AdminPlans({ initial, stripeConfigured }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>(initial.map(toDraft));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ slug: string; text: string; kind: "ok" | "err" } | null>(null);

  const update = (slug: string, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((x) => (x.slug === slug ? { ...x, ...patch } : x)));

  const save = async (d: Draft) => {
    setBusy(`save:${d.slug}`);
    setMsg(null);
    try {
      const cents = Math.round(parseFloat(d.priceDollars || "0") * 100);
      const words = d.wordsPerWeek.trim() === "" ? null : parseInt(d.wordsPerWeek, 10);
      const minutes = d.meetingMinutes.trim() === "" ? null : parseInt(d.meetingMinutes, 10);
      const { item, needsSync } = await api<{ item: PlanDTO & { wordsPerWeek: number | null }; needsSync: boolean }>("/api/admin/plans", "PUT", {
        slug: d.slug,
        name: d.name,
        description: d.description,
        priceMonthlyCents: Number.isFinite(cents) ? cents : 0,
        wordsPerWeek: words,
        meetingMinutesPerMonth: minutes,
        features: d.features.split("\n").map((f) => f.trim()).filter(Boolean),
        cta: d.cta,
        active: d.active,
        sortOrder: d.sortOrder,
      });
      setDrafts((all) => all.map((x) => (x.slug === d.slug ? { ...toDraft({ ...item, description: item.description ?? "", features: item.features ?? [] } as PlanDTO), isNew: false } : x)));
      setMsg({ slug: d.slug, text: needsSync ? "Saved. Sync to Stripe to enable checkout." : "Saved.", kind: "ok" });
    } catch (e) {
      setMsg({ slug: d.slug, text: e instanceof Error ? e.message : "Save failed", kind: "err" });
    } finally {
      setBusy(null);
    }
  };

  const sync = async (d: Draft) => {
    setBusy(`sync:${d.slug}`);
    setMsg(null);
    try {
      const { item, changed } = await api<{ item: PlanDTO; changed: boolean }>("/api/admin/plans/sync", "POST", { slug: d.slug });
      update(d.slug, { stripePriceId: item.stripePriceId, stripeProductId: item.stripeProductId });
      setMsg({ slug: d.slug, text: changed ? "New Stripe price created. New checkouts use it; existing subscribers keep their price." : "Stripe is up to date.", kind: "ok" });
    } catch (e) {
      setMsg({ slug: d.slug, text: e instanceof Error ? e.message : "Sync failed", kind: "err" });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (d: Draft) => {
    if (d.isNew) {
      setDrafts((all) => all.filter((x) => x.slug !== d.slug));
      return;
    }
    if (!confirm(`Delete the "${d.name}" plan? This cannot be undone.`)) return;
    setBusy(`del:${d.slug}`);
    try {
      await api("/api/admin/plans", "DELETE", { slug: d.slug });
      setDrafts((all) => all.filter((x) => x.slug !== d.slug));
    } catch (e) {
      setMsg({ slug: d.slug, text: e instanceof Error ? e.message : "Delete failed", kind: "err" });
    } finally {
      setBusy(null);
    }
  };

  const addPlan = () => {
    const slug = `plan-${Date.now().toString(36)}`;
    setDrafts((all) => [
      ...all,
      { slug, name: "New plan", description: "", priceDollars: "0.00", wordsPerWeek: "", meetingMinutes: "", features: "", cta: "checkout", active: false, sortOrder: all.length, stripePriceId: null, stripeProductId: null, isNew: true },
    ]);
  };

  return (
    <div className="flex flex-col gap-5">
      {!stripeConfigured && (
        <p className="flex items-center gap-2 rounded-xl border border-orange/50 bg-orange/10 p-3 text-sm">
          <AlertTriangle className="size-4 text-orange" /> STRIPE_SECRET_KEY is not set. Plans can be edited but not synced to Stripe.
        </p>
      )}
      <p className="text-sm text-ink/60">
        Changes to names, limits and features apply immediately. Price changes take effect for new checkouts after you sync the plan to Stripe.
      </p>

      {drafts.map((d) => {
        const needsSync = d.cta === "checkout" && parseFloat(d.priceDollars || "0") > 0 && !d.stripePriceId;
        return (
          <div key={d.slug} className={cn("rounded-card border bg-cream-2 p-5", d.active ? "border-ink/10" : "border-dashed border-ink/20")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-pill bg-ink/5 px-2.5 py-1 font-mono text-xs">{d.slug}</span>
                {d.isNew && <span className="text-xs text-ink/60">unsaved</span>}
                {!d.active && <span className="text-xs text-ink/60">hidden from pricing page</span>}
                {d.stripePriceId ? (
                  <span className="inline-flex items-center gap-1 text-xs text-forest"><Check className="size-3" /> Stripe synced</span>
                ) : needsSync ? (
                  <span className="inline-flex items-center gap-1 text-xs text-orange"><AlertTriangle className="size-3" /> Not in Stripe yet</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {d.cta === "checkout" && stripeConfigured && !d.isNew && (
                  <button type="button" onClick={() => sync(d)} disabled={busy !== null} className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-ink/20 px-3 text-xs">
                    {busy === `sync:${d.slug}` ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Sync to Stripe
                  </button>
                )}
                <button type="button" onClick={() => save(d)} disabled={busy !== null} className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-ink px-3 text-xs text-cream">
                  {busy === `save:${d.slug}` ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
                </button>
                {d.slug !== "free" && (
                  <button type="button" onClick={() => remove(d)} disabled={busy !== null} aria-label="Delete plan" className="p-2 text-ink/60 hover:text-coral">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>

            {msg?.slug === d.slug && (
              <p className={cn("mt-3 rounded-lg p-2.5 text-xs", msg.kind === "ok" ? "bg-mint/20 text-forest" : "bg-coral/10 text-coral")}>{msg.text}</p>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Field label="Name">
                <input className={input} value={d.name} onChange={(e) => update(d.slug, { name: e.target.value })} />
              </Field>
              <Field label="Monthly price (USD)">
                <input className={input} type="number" min="0" step="0.01" value={d.priceDollars} onChange={(e) => update(d.slug, { priceDollars: e.target.value })} disabled={d.cta !== "checkout"} />
              </Field>
              <Field label="Words per week (blank = unlimited)">
                <input className={input} type="number" min="1" value={d.wordsPerWeek} onChange={(e) => update(d.slug, { wordsPerWeek: e.target.value })} placeholder="Unlimited" />
              </Field>
              <Field label="Meeting minutes per month (blank = unlimited)">
                <input className={input} type="number" min="0" value={d.meetingMinutes} onChange={(e) => update(d.slug, { meetingMinutes: e.target.value })} placeholder="Unlimited" />
              </Field>
              <Field label="Button type">
                <select className={input} value={d.cta} onChange={(e) => update(d.slug, { cta: e.target.value as Draft["cta"] })}>
                  <option value="free">Free (sign up)</option>
                  <option value="checkout">Stripe checkout</option>
                  <option value="contact">Contact sales</option>
                </select>
              </Field>
              <Field label="Description" className="md:col-span-2">
                <input className={input} value={d.description} onChange={(e) => update(d.slug, { description: e.target.value })} />
              </Field>
              <Field label="Sort order">
                <input className={input} type="number" value={d.sortOrder} onChange={(e) => update(d.slug, { sortOrder: parseInt(e.target.value || "0", 10) })} />
              </Field>
              <Field label="Visible on pricing page">
                <button
                  type="button"
                  role="switch"
                  aria-checked={d.active}
                  onClick={() => update(d.slug, { active: !d.active })}
                  className={cn("relative mt-1.5 h-6 w-11 rounded-pill transition-colors", d.active ? "bg-forest" : "bg-ink/20")}
                >
                  <span className={cn("absolute top-0.5 size-5 rounded-full bg-cream transition-all", d.active ? "left-[22px]" : "left-0.5")} />
                </button>
              </Field>
              <Field label="Features (one per line)" className="md:col-span-4">
                <textarea className="rounded-lg border border-ink/15 bg-cream px-2.5 py-2 text-sm text-ink" rows={4} value={d.features} onChange={(e) => update(d.slug, { features: e.target.value })} />
              </Field>
            </div>
            {d.stripePriceId && (
              <p className="mt-3 font-mono text-[11px] text-ink/60">product {d.stripeProductId} · price {d.stripePriceId}</p>
            )}
          </div>
        );
      })}

      <button type="button" onClick={addPlan} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-pill border border-ink/20 px-4 text-sm">
        <Plus className="size-4" /> Add plan
      </button>
    </div>
  );
}
