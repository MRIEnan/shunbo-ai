"use client";

import { useState } from "react";
import { Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";

type State = { enabled: boolean; message: string; since: string | null };

export function AdminMaintenance({ initial }: { initial: State }) {
  const [state, setState] = useState<State>(initial);
  const [message, setMessage] = useState(initial.message);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (enabled: boolean) => {
    if (enabled && !state.enabled && !confirm("Pause all AI features for every user? Dictation, meetings, notes and translation stop until you turn this off.")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/maintenance", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, message }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setState(data);
      setMessage(data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("rounded-card border p-5", state.enabled ? "border-coral/50 bg-coral/10" : "border-ink/10 bg-cream-2")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="size-4" /> AI maintenance
            <span className={cn("rounded-pill px-2 py-0.5 text-[11px]", state.enabled ? "bg-coral text-cream" : "bg-forest/15 text-forest")}>
              {state.enabled ? "AI paused" : "AI running"}
            </span>
          </div>
          <p className="mt-1 max-w-xl text-xs text-ink/60">
            {state.enabled
              ? `Paused since ${state.since ? new Date(state.since).toLocaleString() : "now"}. No OpenAI calls are made; users see the message below as a toast.`
              : "Pause stops every OpenAI call (dictation, meetings, notes, translation). Users get a maintenance toast instead."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => save(!state.enabled)}
          disabled={saving}
          className={cn("inline-flex h-10 items-center gap-2 rounded-pill px-5 text-sm font-medium text-cream disabled:opacity-60", state.enabled ? "bg-forest" : "bg-coral")}
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {state.enabled ? "Resume AI" : "Pause AI"}
        </button>
      </div>
      <label className="mt-4 block text-xs text-ink/60" htmlFor="maint-msg">Message shown to users</label>
      <div className="mt-1 flex gap-2">
        <input id="maint-msg" value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-ink/15 bg-cream px-3 text-sm" />
        {state.enabled && message !== state.message && (
          <button type="button" onClick={() => save(true)} disabled={saving} className="h-10 rounded-pill border border-ink/20 px-4 text-sm">
            Update
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-coral">{error}</p>}
    </div>
  );
}
