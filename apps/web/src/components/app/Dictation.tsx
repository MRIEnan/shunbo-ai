"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Copy, Check, Trash2, X, Plus, Loader2, AlertCircle, Keyboard, Cloud } from "lucide-react";
import { useRecorder } from "@/lib/use-recorder";
import { store, FREE_ANON_LIMIT, LANGUAGES, type Dictation, type Settings } from "@/lib/local-store";
import { TONES, TONE_LABELS, type Tone, type SnippetHint } from "@/lib/prompts";
import { cn } from "@/lib/cn";

type Stage = "idle" | "transcribing" | "polishing" | "error";
type Props = { signedIn: boolean };

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

function Bars({ level, active }: { level: number; active: boolean }) {
  const seeds = useMemo(() => Array.from({ length: 28 }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + 0.5))), []);
  return (
    <div className="flex h-16 items-center justify-center gap-[3px]" aria-hidden>
      {seeds.map((s, i) => {
        const h = active ? Math.max(4, Math.min(64, 6 + level * 90 * s)) : 4;
        return (
          <span
            key={i}
            className={cn("w-[3px] rounded-full transition-[height] duration-75", active ? "bg-forest" : "bg-ink/20")}
            style={{ height: h }}
          />
        );
      })}
    </div>
  );
}

export function DictationApp({ signedIn }: Props) {
  const rec = useRecorder();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  // Rendered client-only (see DictationLoader), so lazy initializers can read localStorage safely.
  const [settings, setSettings] = useState<Settings>(() => store.getSettings());
  const [history, setHistory] = useState<Dictation[]>(() => (signedIn ? [] : store.getHistory()));
  const [usage, setUsage] = useState(() => store.getUsage());
  const [snippets, setSnippets] = useState<SnippetHint[]>([]);
  const [current, setCurrent] = useState<Dictation | null>(null);
  const [view, setView] = useState<"clean" | "raw">("clean");
  const [copied, setCopied] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [syncing, setSyncing] = useState(signedIn);
  const [quota, setQuota] = useState<{ used: number; limit: number | null; planName: string } | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);
  const busyRef = useRef(false);
  const vocabIds = useRef<Map<string, string>>(new Map());

  // Load server state when signed in
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const [s, h, u] = await Promise.all([
          api<{
            settings: Pick<Settings, "tone" | "language" | "autoCopy">;
            vocabulary: { id: string; word: string }[];
            snippets: SnippetHint[];
          }>("/api/settings"),
          api<{ items: Dictation[] }>("/api/dictations?limit=20"),
          api<{ used: number; limit: number | null; plan: { name: string }; overLimit: boolean }>("/api/usage"),
        ]);
        if (cancelled) return;
        setQuota({ used: u.used, limit: u.limit, planName: u.plan.name });
        setQuotaHit(u.overLimit);
        vocabIds.current = new Map(s.vocabulary.map((w) => [w.word, w.id]));
        setSettings({ ...s.settings, vocabulary: s.vocabulary.map((w) => w.word) });
        setSnippets(s.snippets);
        setHistory(h.items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load your settings");
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((s) => {
        const next = { ...s, ...patch };
        if (!signedIn) store.setSettings(next);
        return next;
      });
      if (signedIn && ("tone" in patch || "language" in patch || "autoCopy" in patch)) {
        api("/api/settings", "PUT", patch).catch(() => {});
      }
    },
    [signedIn],
  );

  const limitReached = (!signedIn && usage >= FREE_ANON_LIMIT) || (signedIn && quotaHit);
  const isRecording = rec.state === "recording";
  const busy = stage === "transcribing" || stage === "polishing" || rec.state === "requesting" || rec.state === "stopping";

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }, []);

  const runPipeline = useCallback(
    async (blob: Blob, durationSec: number) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setError(null);
      try {
        setStage("transcribing");
        const fd = new FormData();
        const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
        fd.append("audio", blob, `dictation.${ext}`);
        fd.append("language", settings.language);
        fd.append("vocabulary", settings.vocabulary.join(","));
        const tRes = await fetch("/api/transcribe", { method: "POST", body: fd });
        const tData = await tRes.json().catch(() => ({}));
        if (tRes.status === 402) {
          setQuotaHit(true);
          setQuota((q) => (q ? { ...q, used: tData.used ?? q.used, limit: tData.limit ?? q.limit } : q));
          throw new Error(tData.error ?? "Weekly word limit reached");
        }
        if (!tRes.ok) throw new Error(tData.error ?? "Transcription failed");
        const raw: string = tData.text ?? "";
        if (!raw.trim()) throw new Error("We didn't catch anything. Try speaking a little closer to the mic.");

        setStage("polishing");
        const { text: clean } = await api<{ text: string }>("/api/clean", "POST", {
          raw,
          tone: settings.tone,
          vocabulary: settings.vocabulary,
          snippets,
        });

        let d: Dictation = {
          id: crypto.randomUUID(),
          raw,
          clean,
          tone: settings.tone,
          durationSec,
          createdAt: Date.now(),
        };
        if (signedIn) {
          try {
            const { item } = await api<{ item: Dictation }>("/api/dictations", "POST", {
              raw,
              clean,
              tone: settings.tone,
              durationSec,
              language: settings.language,
            });
            d = item;
            setQuota((q) => {
              if (!q) return q;
              const used = q.used + (clean.trim().match(/\S+/g) ?? []).length;
              if (q.limit !== null && used >= q.limit) setQuotaHit(true);
              return { ...q, used };
            });
          } catch {
            setError("Saved locally only: couldn't sync this dictation to your account.");
          }
          setHistory((h) => [d, ...h]);
        } else {
          setHistory(store.addDictation(d));
          setUsage(store.bumpUsage());
        }
        setCurrent(d);
        setView("clean");
        if (settings.autoCopy) copyText(clean);
        setStage("idle");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setStage("error");
      } finally {
        busyRef.current = false;
      }
    },
    [settings, snippets, signedIn, copyText],
  );

  const toggle = useCallback(async () => {
    if (busy) return;
    if (isRecording) {
      const duration = rec.elapsed;
      const blob = await rec.stop();
      if (blob) await runPipeline(blob, duration);
    } else {
      if (limitReached) return;
      setError(null);
      setStage("idle");
      try {
        await rec.start();
      } catch {
        setError("Microphone access was blocked. Allow the mic in your browser settings and try again.");
      }
    }
  }, [busy, isRecording, rec, runPipeline, limitReached]);

  // Ctrl+Space toggles recording; Escape cancels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape" && isRecording) {
        rec.cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, isRecording, rec]);

  const addWord = async () => {
    const w = newWord.trim();
    if (!w || settings.vocabulary.includes(w)) return;
    updateSettings({ vocabulary: [...settings.vocabulary, w].slice(0, 100) });
    setNewWord("");
    if (signedIn) {
      try {
        const { item } = await api<{ item: { id: string; word: string } }>("/api/vocabulary", "POST", { word: w });
        vocabIds.current.set(item.word, item.id);
      } catch {
        setError("Couldn't save that word to your account.");
      }
    }
  };

  const removeWord = (w: string) => {
    updateSettings({ vocabulary: settings.vocabulary.filter((x) => x !== w) });
    const id = vocabIds.current.get(w);
    if (signedIn && id) api("/api/vocabulary", "DELETE", { id }).catch(() => {});
  };

  const removeDictation = (id: string) => {
    if (signedIn) {
      setHistory((h) => h.filter((d) => d.id !== id));
      api(`/api/dictations/${id}`, "DELETE").catch(() => {});
    } else {
      setHistory(store.removeDictation(id));
    }
  };

  const clearHistory = () => {
    setHistory([]);
    if (signedIn) api("/api/dictations", "DELETE").catch(() => {});
    else store.clearHistory();
  };

  const statusText =
    rec.state === "unsupported"
      ? "Your browser doesn't support audio recording. Try Chrome or Edge."
      : rec.state === "denied"
        ? "Microphone blocked. Allow access in your browser settings."
        : stage === "transcribing"
          ? "Transcribing…"
          : stage === "polishing"
            ? "Polishing…"
            : isRecording
              ? `Listening · ${rec.elapsed.toFixed(0)}s`
              : limitReached
                ? "Free demo limit reached"
                : "Click or press Ctrl+Space to start";

  const shown = current ? (view === "clean" ? current.clean : current.raw) : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {/* Main panel */}
      <div className="flex flex-col gap-6">
        <div className="rounded-card border border-ink/10 bg-cream-2 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-5">
            <Bars level={rec.level} active={isRecording} />
            <button
              type="button"
              onClick={toggle}
              disabled={busy || limitReached || rec.state === "unsupported"}
              aria-pressed={isRecording}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              className={cn(
                "relative flex size-20 items-center justify-center rounded-full border transition-all",
                isRecording
                  ? "bg-coral text-cream border-coral shadow-[0_0_0_10px_rgba(255,108,76,0.18)]"
                  : "bg-forest text-cream border-forest hover:bg-forest-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {busy && !isRecording ? (
                <Loader2 className="size-7 animate-spin" />
              ) : isRecording ? (
                <Square className="size-6 fill-current" />
              ) : (
                <Mic className="size-7" />
              )}
              {isRecording && (
                <motion.span
                  className="absolute inset-0 rounded-full border-2 border-coral"
                  animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                />
              )}
            </button>
            <p className="text-sm text-ink/60 min-h-5" aria-live="polite">
              {statusText}
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-ink/60">
              <Keyboard className="size-3.5" /> Ctrl+Space to start/stop · Esc to cancel
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 flex items-start gap-2 rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-coral" />
                <span className="flex-1">{error}</span>
                <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
                  <X className="size-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {signedIn && quotaHit && (
            <div className="mt-5 rounded-xl bg-lavender p-4 text-sm">
              <div className="font-medium">You&rsquo;ve hit the {quota?.limit?.toLocaleString()} words per week limit on the {quota?.planName} plan.</div>
              <p className="mt-1 text-ink/70">Upgrade to Pro for unlimited dictation, or wait until Monday when your limit resets.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/pricing" className="inline-flex h-9 items-center rounded-pill bg-ink px-4 text-cream text-xs font-medium">
                  See plans
                </Link>
              </div>
            </div>
          )}

          {!signedIn && limitReached && (
            <div className="mt-5 rounded-xl bg-lavender p-4 text-sm">
              <div className="font-medium">You&rsquo;ve used your {FREE_ANON_LIMIT} free demo dictations.</div>
              <p className="mt-1 text-ink/70">Create a free account to keep going and sync your history across devices.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/signin?callbackUrl=/app" className="inline-flex h-9 items-center rounded-pill bg-ink px-4 text-cream text-xs font-medium">
                  Sign in with email
                </Link>
                {process.env.NODE_ENV === "development" && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("shunbo.usage");
                      setUsage(0);
                    }}
                    className="h-9 rounded-pill border border-ink/20 px-4 text-xs"
                  >
                    Reset demo counter (dev only)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Output */}
        <div className="rounded-card border border-ink/10 bg-cream-2">
          <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
            <div className="inline-flex rounded-pill border border-ink/15 p-0.5 text-xs">
              {(["clean", "raw"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn("rounded-pill px-3 py-1.5 transition-colors", view === v ? "bg-ink text-cream" : "text-ink/60 hover:text-ink")}
                >
                  {v === "clean" ? "Polished" : "Raw transcript"}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!shown}
              onClick={() => copyText(shown)}
              className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-ink/15 px-3 text-xs disabled:opacity-40"
            >
              {copied ? <Check className="size-3.5 text-forest" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="min-h-[10rem] p-5">
            <AnimatePresence mode="wait">
              {shown ? (
                <motion.p
                  key={current!.id + view}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn("whitespace-pre-wrap leading-relaxed", view === "raw" && "text-ink/70 font-serif italic")}
                >
                  {shown}
                </motion.p>
              ) : (
                <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-ink/60">
                  Your polished text will appear here. Try: &ldquo;Um, hey, can you, uh, send me the the report by, actually, end of day?&rdquo;
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* History */}
        {(history.length > 0 || syncing) && (
          <div className="rounded-card border border-ink/10 bg-cream-2">
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
              <h2 className="inline-flex items-center gap-2 text-sm font-medium">
                Recent
                {signedIn && <Cloud className="size-3.5 text-forest" aria-label="Synced to your account" />}
              </h2>
              <div className="flex items-center gap-3 text-xs">
                {signedIn && (
                  <Link href="/history" className="text-ink/60 hover:text-ink">
                    View all
                  </Link>
                )}
                <button type="button" onClick={clearHistory} className="text-ink/60 hover:text-ink">
                  Clear all
                </button>
              </div>
            </div>
            {syncing ? (
              <div className="flex items-center justify-center p-6 text-ink/60">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : (
              <ul className="divide-y divide-ink/10">
                {history.map((d) => (
                  <li key={d.id} className="group flex items-start gap-3 px-5 py-3">
                    <button type="button" onClick={() => { setCurrent(d); setView("clean"); }} className="flex-1 text-left">
                      <p className="line-clamp-2 text-sm">{d.clean}</p>
                      <p className="mt-1 text-[11px] text-ink/60">
                        {new Date(d.createdAt).toLocaleString()} · {TONE_LABELS[d.tone]} · {Math.round(d.durationSec)}s
                      </p>
                    </button>
                    <button type="button" onClick={() => copyText(d.clean)} aria-label="Copy" className="p-1 text-ink/60 hover:text-ink">
                      <Copy className="size-4" />
                    </button>
                    <button type="button" onClick={() => removeDictation(d.id)} aria-label="Delete" className="p-1 text-ink/60 hover:text-coral">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Settings */}
      <aside className="flex flex-col gap-5 lg:sticky lg:top-24 self-start">
        <div className="rounded-card border border-ink/10 bg-cream-2 p-5">
          <h2 className="text-sm font-medium">Style</h2>
          <div className="mt-3 inline-flex rounded-pill border border-ink/15 bg-cream p-0.5 text-xs">
            {TONES.map((t: Tone) => (
              <button
                key={t}
                type="button"
                onClick={() => updateSettings({ tone: t })}
                className={cn("rounded-pill px-3 py-1.5 transition-colors", settings.tone === t ? "bg-lavender border border-ink/15" : "text-ink/60")}
              >
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>

          <h2 className="mt-5 text-sm font-medium">Language</h2>
          <select
            aria-label="Language"
            value={settings.language}
            onChange={(e) => updateSettings({ language: e.target.value })}
            className="mt-2 h-10 w-full rounded-xl border border-ink/15 bg-cream px-3 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>

          <label className="mt-5 flex items-center justify-between text-sm">
            <span>Auto-copy result</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoCopy}
              onClick={() => updateSettings({ autoCopy: !settings.autoCopy })}
              className={cn("relative h-6 w-11 rounded-pill transition-colors", settings.autoCopy ? "bg-forest" : "bg-ink/20")}
            >
              <span className={cn("absolute top-0.5 size-5 rounded-full bg-cream transition-all", settings.autoCopy ? "left-[22px]" : "left-0.5")} />
            </button>
          </label>
        </div>

        <div className="rounded-card border border-ink/10 bg-cream-2 p-5">
          <h2 className="text-sm font-medium">Vocabulary</h2>
          <p className="mt-1 text-xs text-ink/60">Names and jargon Shunbo should spell correctly.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addWord();
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="e.g. Priya, Kubernetes"
              className="h-9 flex-1 rounded-xl border border-ink/15 bg-cream px-3 text-sm"
            />
            <button type="submit" aria-label="Add word" className="flex size-9 items-center justify-center rounded-xl bg-ink text-cream">
              <Plus className="size-4" />
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {settings.vocabulary.map((w) => (
              <span key={w} className="inline-flex items-center gap-1 rounded-pill border border-ink/15 bg-cream px-2.5 py-1 text-xs">
                {w}
                <button type="button" aria-label={`Remove ${w}`} onClick={() => removeWord(w)}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          {signedIn && snippets.length > 0 && (
            <p className="mt-4 text-xs text-ink/60">
              {snippets.length} snippet{snippets.length === 1 ? "" : "s"} active.{" "}
              <Link href="/settings" className="underline">Manage</Link>
            </p>
          )}
        </div>

        {signedIn ? (
          <p className="text-center text-xs text-ink/60">
            {quota
              ? quota.limit === null
                ? `${quota.planName} plan · unlimited words`
                : `${Math.max(0, quota.limit - quota.used).toLocaleString()} of ${quota.limit.toLocaleString()} words left this week · `
              : ""}
            {quota && quota.limit !== null && (
              <Link href="/pricing" className="underline">Upgrade</Link>
            )}
          </p>
        ) : (
          !limitReached && (
            <p className="text-center text-xs text-ink/60">
              {FREE_ANON_LIMIT - usage} of {FREE_ANON_LIMIT} free demo dictations left ·{" "}
              <Link href="/signin?callbackUrl=/app" className="underline">
                Sign in
              </Link>
            </p>
          )
        )}
      </aside>
    </div>
  );
}
