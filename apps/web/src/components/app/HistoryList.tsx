"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Copy, Check, Trash2, Loader2 } from "lucide-react";
import { TONE_LABELS } from "@/lib/prompts";
import type { Dictation } from "@/lib/local-store";
import { cn } from "@/lib/cn";
import { LanguageBadge } from "@/components/meetings/LanguageBadge";

type Props = { initial: Dictation[]; initialCursor: string | null };

export function HistoryList({ initial, initialCursor }: Props) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/dictations?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setCursor(data.nextCursor ?? null);
      setLoading(false);
    }, 250);
  }, [q]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    const res = await fetch(`/api/dictations?q=${encodeURIComponent(q)}&cursor=${cursor}`);
    const data = await res.json();
    setItems((prev) => [...prev, ...(data.items ?? [])]);
    setCursor(data.nextCursor ?? null);
    setLoading(false);
  };

  const copy = async (d: Dictation) => {
    await navigator.clipboard.writeText(d.clean).catch(() => {});
    setCopiedId(d.id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((d) => d.id !== id));
    await fetch(`/api/dictations/${id}`, { method: "DELETE" });
  };

  return (
    <div className="rounded-card border border-ink/10 bg-cream-2">
      <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
        <Search className="size-4 text-ink/60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your dictations"
          className="h-9 flex-1 bg-transparent text-sm outline-none"
        />
        {loading && <Loader2 className="size-4 animate-spin text-ink/60" />}
      </div>

      {items.length === 0 ? (
        <p className="p-8 text-center text-sm text-ink/60">
          {q ? "No dictations match that search." : "No dictations yet. Head to Dictate and say something."}
        </p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {items.map((d) => (
            <li key={d.id} className="flex items-start gap-3 px-5 py-4">
              <button type="button" onClick={() => setExpanded(expanded === d.id ? null : d.id)} className="flex-1 text-left">
                <p className={cn("text-sm leading-relaxed", expanded !== d.id && "line-clamp-2")}>{d.clean}</p>
                {expanded === d.id && (
                  <p className="mt-3 rounded-xl bg-sand-2 p-3 font-serif text-sm italic text-ink/70">{d.raw}</p>
                )}
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink/60">
                  <span>{new Date(d.createdAt).toLocaleString()} · {TONE_LABELS[d.tone]} · {Math.round(d.durationSec)}s</span>
                  {d.detectedLanguage && <LanguageBadge code={d.detectedLanguage} />}
                </p>
              </button>
              <button type="button" onClick={() => copy(d)} aria-label="Copy" className="p-1 text-ink/60 hover:text-ink">
                {copiedId === d.id ? <Check className="size-4 text-forest" /> : <Copy className="size-4" />}
              </button>
              <button type="button" onClick={() => remove(d.id)} aria-label="Delete" className="p-1 text-ink/60 hover:text-coral">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <div className="border-t border-ink/10 p-3 text-center">
          <button type="button" onClick={loadMore} disabled={loading} className="rounded-pill border border-ink/15 px-4 py-1.5 text-xs">
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
