"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Trash2, RefreshCw, Loader2, Pencil, Check, Copy, AlertCircle } from "lucide-react";
import { StatusPill } from "./MeetingList";
import { cn } from "@/lib/cn";

type Segment = { id: string; speaker: string; track: string; startSec: number; endSec: number; text: string };
type Meeting = {
  id: string;
  title: string;
  status: string;
  source: string;
  durationSec: number;
  startedAt: number;
  endedAt: number | null;
  error: string | null;
  notes: { summary: string; actionItems: string[]; decisions: string[]; questions: string[] } | null;
  segments: Segment[];
  chunks: { index: number; track: string; status: string; error: string | null }[];
};

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const SPEAKER_COLORS = ["text-forest", "text-coral", "text-[#7c3aed]", "text-[#b45309]", "text-[#0369a1]", "text-[#be185d]"];
function speakerColor(name: string) {
  if (name === "You") return "text-ink";
  const n = parseInt(name.replace(/\D/g, ""), 10);
  return SPEAKER_COLORS[(Number.isFinite(n) ? n : 0) % SPEAKER_COLORS.length];
}

export function MeetingView({ id }: { id: string }) {
  const router = useRouter();
  const [m, setM] = useState<Meeting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/meetings/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Couldn't load meeting");
      return null;
    }
    setM(data.item);
    setTitle(data.item.title);
    return data.item as Meeting;
  }, [id]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const tick = async () => {
      const item = await load();
      if (stopped) return;
      if (item && (item.status === "recording" || item.status === "processing")) timer = setTimeout(tick, 10_000);
    };
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  const saveTitle = async () => {
    setBusy("title");
    await fetch(`/api/meetings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    setEditing(false);
    setBusy(null);
    load();
  };

  const regenerate = async () => {
    setBusy("notes");
    const res = await fetch(`/api/meetings/${id}/finish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regenerate: true }) });
    if (!res.ok) setError((await res.json()).error ?? "Couldn't generate notes");
    setBusy(null);
    load();
  };

  const remove = async () => {
    if (!confirm("Delete this meeting and its transcript? This cannot be undone.")) return;
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    router.push("/meetings");
  };

  const copyNotes = async () => {
    if (!m?.notes) return;
    const text = [m.notes.summary, "", ...(m.notes.actionItems.length ? ["Action items:", ...m.notes.actionItems.map((a) => `- ${a}`), ""] : []), ...(m.notes.decisions.length ? ["Decisions:", ...m.notes.decisions.map((d) => `- ${d}`)] : [])].join("\n");
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!m) {
    return (
      <div className="flex h-64 items-center justify-center text-ink/60">
        {error ? <span className="text-sm">{error}</span> : <Loader2 className="size-6 animate-spin" />}
      </div>
    );
  }

  const failedChunks = m.chunks.filter((c) => c.status === "failed");

  return (
    <>
      <div className="mb-6">
        <Link href="/meetings" className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
          <ArrowLeft className="size-4" /> All meetings
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {editing ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveTitle();
                }}
              >
                <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="display h-12 flex-1 rounded-xl border border-ink/15 bg-cream px-3 text-3xl" />
                <button type="submit" className="h-12 rounded-pill bg-ink px-4 text-sm text-cream">{busy === "title" ? <Loader2 className="size-4 animate-spin" /> : "Save"}</button>
              </form>
            ) : (
              <h1 className="display flex items-center gap-3 text-4xl sm:text-5xl">
                <span className="truncate">{m.title}</span>
                <button type="button" onClick={() => setEditing(true)} aria-label="Rename" className="text-ink/60 hover:text-ink"><Pencil className="size-5" /></button>
              </h1>
            )}
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/60">
              <StatusPill status={m.status} />
              {new Date(m.startedAt).toLocaleString()} · {Math.max(1, Math.round(m.durationSec / 60))} min · {m.source === "web" ? "browser" : "desktop"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/meetings/${id}/export`} className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-ink/15 px-3 text-xs"><Download className="size-3.5" /> Export .md</a>
            {m.status !== "recording" && (
              <button type="button" onClick={regenerate} disabled={busy !== null} className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-ink/15 px-3 text-xs">
                {busy === "notes" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Regenerate notes
              </button>
            )}
            <button type="button" onClick={remove} aria-label="Delete meeting" className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-ink/15 px-3 text-xs text-coral"><Trash2 className="size-3.5" /> Delete</button>
          </div>
        </div>
      </div>

      {m.status === "recording" && (
        <p className="mb-5 flex items-center gap-2 rounded-xl bg-coral/10 p-3 text-sm"><span className="size-2 animate-pulse rounded-full bg-coral" /> Recording in progress. The transcript updates every 10 seconds.</p>
      )}
      {m.status === "processing" && (
        <p className="mb-5 flex items-center gap-2 rounded-xl bg-lavender p-3 text-sm"><Loader2 className="size-4 animate-spin" /> Generating notes…</p>
      )}
      {(m.status === "failed" || failedChunks.length > 0 || error) && (
        <p className="mb-5 flex items-start gap-2 rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-coral" />
          <span>
            {error ?? m.error ?? ""}
            {failedChunks.length > 0 && ` ${failedChunks.length} audio chunk${failedChunks.length === 1 ? "" : "s"} failed to transcribe: ${failedChunks[0].error ?? ""}`}
          </span>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="rounded-card border border-ink/10 bg-cream-2">
          <div className="border-b border-ink/10 px-5 py-3 text-sm font-medium">Transcript</div>
          {m.segments.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink/60">{m.status === "recording" ? "Waiting for the first audio chunk…" : "No speech was detected."}</p>
          ) : (
            <ol className="divide-y divide-ink/5">
              {m.segments.map((s) => (
                <li key={s.id} className="grid grid-cols-[3.5rem_7rem_1fr] gap-3 px-5 py-2.5 text-sm">
                  <span className="font-mono text-[11px] text-ink/60 pt-0.5">{fmt(s.startSec)}</span>
                  <span className={cn("font-medium", speakerColor(s.speaker))}>{s.speaker}</span>
                  <span className="leading-relaxed">{s.text}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 self-start">
          <section className="rounded-card border border-ink/10 bg-cream-2 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Notes</h2>
              {m.notes && (
                <button type="button" onClick={copyNotes} className="inline-flex items-center gap-1 text-xs text-ink/60 hover:text-ink">
                  {copied ? <Check className="size-3.5 text-forest" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
            {!m.notes ? (
              <p className="mt-3 text-sm text-ink/60">{m.status === "done" ? "No notes yet. Click Regenerate notes." : "Notes appear when the meeting ends."}</p>
            ) : (
              <div className="mt-3 flex flex-col gap-4 text-sm">
                <p className="leading-relaxed">{m.notes.summary}</p>
                {m.notes.actionItems.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink/60">Action items</h3>
                    <ul className="mt-1.5 flex flex-col gap-1.5">{m.notes.actionItems.map((a, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-forest" />{a}</li>)}</ul>
                  </div>
                )}
                {m.notes.decisions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink/60">Decisions</h3>
                    <ul className="mt-1.5 flex flex-col gap-1.5">{m.notes.decisions.map((d, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-lavender-2" />{d}</li>)}</ul>
                  </div>
                )}
                {m.notes.questions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink/60">Open questions</h3>
                    <ul className="mt-1.5 flex flex-col gap-1.5">{m.notes.questions.map((q, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-coral" />{q}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
