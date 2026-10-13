"use client";

import { useState } from "react";
import { Plus, X, Trash2, Check, Loader2 } from "lucide-react";
import { TONES, TONE_LABELS, type Tone } from "@/lib/prompts";
import { LANGUAGES } from "@/lib/local-store";
import { cn } from "@/lib/cn";

type Word = { id: string; word: string };
type Snippet = { id: string; trigger: string; expansion: string };
type Preset = { id: string; context: string; tone: Tone; instructions: string };
type Settings = { tone: Tone; language: string; autoCopy: boolean };

type Props = { email: string; planName: string; settings: Settings; vocabulary: Word[]; snippets: Snippet[]; presets: Preset[] };

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-ink/10 bg-cream-2 p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ToneToggle({ value, onChange }: { value: Tone; onChange: (t: Tone) => void }) {
  return (
    <div className="inline-flex rounded-pill border border-ink/15 bg-cream p-0.5 text-xs">
      {TONES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn("rounded-pill px-3 py-1.5 transition-colors", value === t ? "bg-lavender border border-ink/15" : "text-ink/60")}
        >
          {TONE_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

export function SettingsPanel(props: Props) {
  const [settings, setSettings] = useState(props.settings);
  const [saved, setSaved] = useState(false);
  const [vocab, setVocab] = useState(props.vocabulary);
  const [snippets, setSnippets] = useState(props.snippets);
  const [presets, setPresets] = useState(props.presets);
  const [word, setWord] = useState("");
  const [trigger, setTrigger] = useState("");
  const [expansion, setExpansion] = useState("");
  const [ctx, setCtx] = useState("");
  const [ctxTone, setCtxTone] = useState<Tone>("casual");
  const [ctxInstr, setCtxInstr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    run("settings", async () => {
      await api("/api/settings", "PUT", next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {error && (
        <p className="lg:col-span-2 rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm">{error}</p>
      )}

      <Section title="Default style" hint="Used for every dictation unless a context preset overrides it.">
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 text-sm">Tone</div>
            <ToneToggle value={settings.tone} onChange={(t) => saveSettings({ tone: t })} />
          </div>
          <div>
            <label className="mb-2 block text-sm" htmlFor="lang">Language</label>
            <select
              id="lang"
              value={settings.language}
              onChange={(e) => saveSettings({ language: e.target.value })}
              className="h-10 w-full max-w-xs rounded-xl border border-ink/15 bg-cream px-3 text-sm"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center justify-between text-sm max-w-xs">
            <span>Auto-copy result to clipboard</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoCopy}
              onClick={() => saveSettings({ autoCopy: !settings.autoCopy })}
              className={cn("relative h-6 w-11 rounded-pill transition-colors", settings.autoCopy ? "bg-forest" : "bg-ink/20")}
            >
              <span className={cn("absolute top-0.5 size-5 rounded-full bg-cream transition-all", settings.autoCopy ? "left-[22px]" : "left-0.5")} />
            </button>
          </label>
          <p className="h-4 text-xs text-ink/60">
            {busy === "settings" ? "Saving…" : saved ? <span className="inline-flex items-center gap-1 text-forest"><Check className="size-3" /> Saved</span> : ""}
          </p>
        </div>
      </Section>

      <Section title="Account">
        <dl className="text-sm">
          <dt className="text-ink/60">Signed in as</dt>
          <dd className="mt-1 font-medium">{props.email}</dd>
          <dt className="mt-4 text-ink/60">Plan</dt>
          <dd className="mt-1 font-medium">{props.planName}</dd>
        </dl>
      </Section>

      <Section title="Vocabulary" hint="Names, products and jargon Shunbo should always spell correctly.">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const w = word.trim();
            if (!w) return;
            run("vocab", async () => {
              const { item } = await api<{ item: Word }>("/api/vocabulary", "POST", { word: w });
              setVocab((v) => (v.some((x) => x.id === item.id) ? v : [...v, item]));
              setWord("");
            });
          }}
        >
          <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="e.g. Priya, Kubernetes" className="h-10 flex-1 rounded-xl border border-ink/15 bg-cream px-3 text-sm" />
          <button type="submit" disabled={busy === "vocab"} className="flex size-10 items-center justify-center rounded-xl bg-ink text-cream">
            {busy === "vocab" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {vocab.length === 0 && <p className="text-xs text-ink/60">No words yet.</p>}
          {vocab.map((w) => (
            <span key={w.id} className="inline-flex items-center gap-1 rounded-pill border border-ink/15 bg-cream px-2.5 py-1 text-xs">
              {w.word}
              <button
                type="button"
                aria-label={`Remove ${w.word}`}
                onClick={() => run("vocab-del", async () => { setVocab((v) => v.filter((x) => x.id !== w.id)); await api("/api/vocabulary", "DELETE", { id: w.id }); })}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      </Section>

      <Section title="Snippets" hint="Say the trigger phrase and Shunbo expands it into the full text.">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!trigger.trim() || !expansion.trim()) return;
            run("snip", async () => {
              const { item } = await api<{ item: Snippet }>("/api/snippets", "POST", { trigger, expansion });
              setSnippets((s) => [...s.filter((x) => x.id !== item.id), item]);
              setTrigger("");
              setExpansion("");
            });
          }}
        >
          <input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder='Trigger, e.g. "my LinkedIn"' className="h-10 rounded-xl border border-ink/15 bg-cream px-3 text-sm" />
          <textarea value={expansion} onChange={(e) => setExpansion(e.target.value)} placeholder="Expansion, e.g. https://linkedin.com/in/you" rows={2} className="rounded-xl border border-ink/15 bg-cream px-3 py-2 text-sm" />
          <button type="submit" disabled={busy === "snip"} className="self-start inline-flex h-9 items-center gap-1.5 rounded-pill bg-ink px-4 text-xs text-cream">
            {busy === "snip" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add snippet
          </button>
        </form>
        <ul className="mt-4 divide-y divide-ink/10">
          {snippets.length === 0 && <li className="text-xs text-ink/60">No snippets yet.</li>}
          {snippets.map((s) => (
            <li key={s.id} className="flex items-start gap-3 py-2.5 text-sm">
              <div className="flex-1">
                <div className="font-medium">&ldquo;{s.trigger}&rdquo;</div>
                <div className="mt-0.5 break-words text-ink/65">{s.expansion}</div>
              </div>
              <button type="button" aria-label="Delete snippet" className="p-1 text-ink/60 hover:text-coral" onClick={() => run("snip-del", async () => { setSnippets((v) => v.filter((x) => x.id !== s.id)); await api("/api/snippets", "DELETE", { id: s.id }); })}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Style per context" hint="Different tone for email, chat, notes, or any app. The desktop app applies these automatically.">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ctx.trim()) return;
            run("preset", async () => {
              const { item } = await api<{ item: Preset }>("/api/presets", "POST", { context: ctx, tone: ctxTone, instructions: ctxInstr });
              setPresets((p) => [...p.filter((x) => x.id !== item.id), item].sort((a, b) => a.context.localeCompare(b.context)));
              setCtx("");
              setCtxInstr("");
            });
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <input value={ctx} onChange={(e) => setCtx(e.target.value)} placeholder="Context, e.g. email, slack, notes" className="h-10 flex-1 min-w-[10rem] rounded-xl border border-ink/15 bg-cream px-3 text-sm" />
            <ToneToggle value={ctxTone} onChange={setCtxTone} />
          </div>
          <input value={ctxInstr} onChange={(e) => setCtxInstr(e.target.value)} placeholder="Optional guidance, e.g. always sign off with 'Best, Enan'" className="h-10 rounded-xl border border-ink/15 bg-cream px-3 text-sm" />
          <button type="submit" disabled={busy === "preset"} className="self-start inline-flex h-9 items-center gap-1.5 rounded-pill bg-ink px-4 text-xs text-cream">
            {busy === "preset" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Save preset
          </button>
        </form>
        <ul className="mt-4 divide-y divide-ink/10">
          {presets.length === 0 && <li className="text-xs text-ink/60">No presets yet.</li>}
          {presets.map((p) => (
            <li key={p.id} className="flex items-start gap-3 py-2.5 text-sm">
              <div className="flex-1">
                <div className="font-medium capitalize">{p.context} <span className="ml-2 rounded-pill bg-lavender px-2 py-0.5 text-[11px] font-normal">{TONE_LABELS[p.tone]}</span></div>
                {p.instructions && <div className="mt-0.5 text-ink/65">{p.instructions}</div>}
              </div>
              <button type="button" aria-label="Delete preset" className="p-1 text-ink/60 hover:text-coral" onClick={() => run("preset-del", async () => { setPresets((v) => v.filter((x) => x.id !== p.id)); await api("/api/presets", "DELETE", { id: p.id }); })}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
