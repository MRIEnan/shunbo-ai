"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Loader2, Mic, Monitor, Globe } from "lucide-react";
import { cn } from "@/lib/cn";

export type MeetingRow = {
  id: string;
  title: string;
  status: string;
  source: string;
  durationSec: number;
  startedAt: number;
  summary: string | null;
};

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    recording: "bg-coral/15 text-coral",
    processing: "bg-lavender text-ink",
    done: "bg-mint/20 text-forest",
    failed: "bg-coral/15 text-coral",
  };
  return <span className={cn("rounded-pill px-2 py-0.5 text-[11px] font-medium", map[status] ?? "bg-ink/5")}>{status}</span>;
}

export function MeetingList({ initial, initialCursor }: { initial: MeetingRow[]; initialCursor: string | null }) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const first = useRef(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/meetings?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setCursor(data.nextCursor ?? null);
      setLoading(false);
    }, 250);
  }, [q]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    const res = await fetch(`/api/meetings?q=${encodeURIComponent(q)}&cursor=${cursor}`);
    const data = await res.json();
    setItems((p) => [...p, ...(data.items ?? [])]);
    setCursor(data.nextCursor ?? null);
    setLoading(false);
  };

  return (
    <div className="rounded-card border border-ink/10 bg-cream-2">
      <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
        <Search className="size-4 text-ink/60" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, notes and transcripts" className="h-9 flex-1 bg-transparent text-sm outline-none" />
        {loading && <Loader2 className="size-4 animate-spin text-ink/60" />}
      </div>
      {items.length === 0 ? (
        <div className="p-10 text-center text-sm text-ink/60">
          <Mic className="mx-auto mb-3 size-6" />
          {q ? "No meetings match that search." : "No meetings yet. Start one from the desktop app, or record a browser call here."}
        </div>
      ) : (
        <ul className="divide-y divide-ink/10">
          {items.map((m) => (
            <li key={m.id}>
              <Link href={`/meetings/${m.id}`} className="flex items-start gap-4 px-5 py-4 hover:bg-ink/[0.02]">
                <span className="mt-1 text-ink/60">{m.source === "web" ? <Globe className="size-4" /> : <Monitor className="size-4" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.title}</span>
                    <StatusPill status={m.status} />
                  </div>
                  {m.summary && <p className="mt-1 line-clamp-2 text-sm text-ink/70">{m.summary}</p>}
                  <p className="mt-1 text-[11px] text-ink/60">
                    {new Date(m.startedAt).toLocaleString()} · {Math.max(1, Math.round(m.durationSec / 60))} min
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <div className="border-t border-ink/10 p-3 text-center">
          <button type="button" onClick={loadMore} disabled={loading} className="rounded-pill border border-ink/15 px-4 py-1.5 text-xs">Load more</button>
        </div>
      )}
    </div>
  );
}
