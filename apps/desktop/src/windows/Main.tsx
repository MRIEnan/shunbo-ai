import { useCallback, useEffect, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregister, isRegistered, type ShortcutEvent } from "@tauri-apps/plugin-global-shortcut";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { onOpenUrl, getCurrent as getCurrentDeepLink } from "@tauri-apps/plugin-deep-link";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Mic, LogOut, ExternalLink, Loader2, Check, AlertCircle, Keyboard, RefreshCw, Power, Bug, Copy } from "lucide-react";
import { info as logInfo, error as logError } from "@tauri-apps/plugin-log";
import { loadPrefs, savePrefs, DEFAULT_PREFS, type Prefs, type Tone } from "@/lib/store";
import { makeApi, ApiError, type Me, type ServerSettings } from "@/lib/api";
import { Recorder } from "@/lib/recorder";
import type { OverlayState } from "./Overlay";
import { Notetaker } from "./Notetaker";
import { Onboarding } from "./Onboarding";

const TONES: { value: Tone; label: string }[] = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "very-casual", label: "Very casual" },
];

const LANGUAGES = [
  ["auto", "Auto-detect"], ["en", "English"], ["bn", "Bengali"], ["hi", "Hindi"], ["es", "Spanish"], ["fr", "French"],
  ["de", "German"], ["pt", "Portuguese"], ["ar", "Arabic"], ["zh", "Chinese"], ["ja", "Japanese"], ["ko", "Korean"],
];

/** Map a foreground process name to a style-preset context. Users can also name presets after the exe directly. */
const APP_CONTEXT: Record<string, string> = {
  outlook: "email", thunderbird: "email", mailspring: "email",
  slack: "chat", discord: "chat", teams: "chat", ms_teams: "chat", telegram: "chat", whatsapp: "chat", signal: "chat",
  notion: "notes", obsidian: "notes", notepad: "notes", onenote: "notes",
  code: "code", cursor: "code", idea64: "code", devenv: "code", windowsterminal: "code",
};

export function MainWindow() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [server, setServer] = useState<ServerSettings | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [shortcutDraft, setShortcutDraft] = useState(DEFAULT_PREFS.shortcut);
  const [shortcutOk, setShortcutOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"dictate" | "notetaker">("dictate");
  const [diag, setDiag] = useState<null | { version: string; debug: boolean; exe: string; log_dir: string; data_dir: string; scheme_target: string; log_tail: string }>(null);
  const [diagCopied, setDiagCopied] = useState(false);

  const prefsRef = useRef(prefs);
  const serverRef = useRef(server);
  const recorder = useRef(new Recorder());
  const busy = useRef(false);
  const contextRef = useRef<string>("");
  prefsRef.current = prefs;
  serverRef.current = server;

  const overlay = (s: OverlayState) => emit("overlay", s);

  // ---- account ----
  const refreshAccount = useCallback(async (p: Prefs) => {
    if (!p.token) {
      setMe(null);
      setServer(null);
      return;
    }
    const api = makeApi(p);
    try {
      const [m, s] = await Promise.all([api.me(), api.settings()]);
      setMe(m);
      setServer(s);
      if (p.email !== m.user.email) setPrefs(await savePrefs({ email: m.user.email }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setPrefs(await savePrefs({ token: null, email: null }));
        setMe(null);
        setStatus({ kind: "err", text: "Your sign-in expired. Please sign in again." });
      } else {
        logError(`refreshAccount failed against ${p.apiUrl}: ${e instanceof Error ? e.message : String(e)}`);
        setStatus({ kind: "err", text: `Can't reach ${p.apiUrl}. Is the server running?` });
      }
    }
  }, []);

  const applyToken = useCallback(
    async (token: string) => {
      logInfo("sign-in token received via deep link");
      const next = await savePrefs({ token: token.trim() });
      setPrefs(next);
      setStatus({ kind: "info", text: "Connecting…" });
      await refreshAccount(next);
      setStatus({ kind: "ok", text: "Connected." });
      await getCurrentWindow().setFocus().catch(() => {});
    },
    [refreshAccount],
  );

  // ---- dictation pipeline ----
  const startDictation = useCallback(async () => {
    if (busy.current || recorder.current.recording) return;
    if (!prefsRef.current.token) {
      overlay({ state: "error", message: "Sign in to Shunbo first" });
      setTimeout(() => overlay({ state: "idle" }), 1800);
      return;
    }
    try {
      contextRef.current = (await invoke<string>("active_app").catch(() => "")) ?? "";
      recorder.current.onLevel = (level, elapsed) => overlay({ state: "listening", level, elapsed });
      await recorder.current.start();
      overlay({ state: "listening", level: 0, elapsed: 0 });
    } catch {
      overlay({ state: "error", message: "Microphone unavailable" });
      setTimeout(() => overlay({ state: "idle" }), 1800);
    }
  }, []);

  const stopDictation = useCallback(async () => {
    if (!recorder.current.recording || busy.current) return;
    busy.current = true;
    const p = prefsRef.current;
    const s = serverRef.current;
    const api = makeApi(p);
    try {
      const { blob, duration } = await recorder.current.stop();
      if (!blob || duration < 0.4) {
        overlay({ state: "idle" });
        return;
      }
      overlay({ state: "transcribing" });
      const vocabulary = s?.vocabulary.map((w) => w.word) ?? [];
      const raw = await api.transcribe(blob, p.language, vocabulary);
      if (!raw.trim()) throw new Error("Didn't catch that");

      // Pick tone from a matching style preset for the active app, else the default.
      const exe = contextRef.current.toLowerCase().replace(/\.exe$/, "");
      const ctx = APP_CONTEXT[exe] ?? exe;
      const preset = s?.presets.find((pr) => pr.context === exe || pr.context === ctx);
      const tone = preset?.tone ?? p.tone;

      overlay({ state: "polishing" });
      const clean = await api.clean(raw, tone, vocabulary, s?.snippets ?? [], preset?.instructions ?? "");

      await writeText(clean);
      if (p.pasteMode === "paste") await invoke("paste_from_clipboard");
      setLast(clean);
      overlay({ state: "done", message: p.pasteMode === "paste" ? clean : "Copied to clipboard" });
      api.save(raw, clean, tone, duration, p.language).catch(() => {});
    } catch (e) {
      const msg = e instanceof ApiError && e.code === "quota_exceeded" ? "Weekly word limit reached. Upgrade to continue." : e instanceof Error ? e.message : "Something went wrong";
      overlay({ state: "error", message: msg });
      setStatus({ kind: "err", text: msg });
    } finally {
      busy.current = false;
      setTimeout(() => overlay({ state: "idle" }), 2200);
    }
  }, []);

  // ---- shortcut ----
  const bindShortcut = useCallback(
    async (combo: string) => {
      const prev = prefsRef.current.shortcut;
      try {
        if (await isRegistered(prev)) await unregister(prev);
      } catch {
        /* ignore */
      }
      try {
        await register(combo, (e: ShortcutEvent) => {
          if (e.state === "Pressed") startDictation();
          else if (e.state === "Released") stopDictation();
        });
        setShortcutOk(true);
        return true;
      } catch {
        setShortcutOk(false);
        return false;
      }
    },
    [startDictation, stopDictation],
  );

  // ---- boot ----
  useEffect(() => {
    let unlistenDeepLink: (() => void) | null = null;
    (async () => {
      const p = await loadPrefs();
      setPrefs(p);
      setShortcutDraft(p.shortcut);
      setLoaded(true);
      await bindShortcut(p.shortcut);
      await refreshAccount(p);

      const handleUrls = (urls: string[]) => {
        for (const u of urls) {
          try {
            const url = new URL(u);
            const token = url.searchParams.get("token");
            if (url.protocol === "shunbo:" && token) applyToken(token);
          } catch {
            /* ignore malformed */
          }
        }
      };
      try {
        const initial = await getCurrentDeepLink();
        if (initial) handleUrls(initial);
        unlistenDeepLink = await onOpenUrl(handleUrls);
      } catch {
        /* plugin unavailable in browser preview */
      }
    })();
    return () => {
      unlistenDeepLink?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = async (patch: Partial<Prefs>) => setPrefs(await savePrefs(patch));

  const signOut = async () => {
    await makeApi(prefs).revokeToken();
    await update({ token: null, email: null });
    setMe(null);
    setServer(null);
    setStatus({ kind: "info", text: "Signed out." });
  };

  const saveShortcut = async () => {
    const ok = await bindShortcut(shortcutDraft);
    if (ok) {
      await update({ shortcut: shortcutDraft });
      setStatus({ kind: "ok", text: "Shortcut updated." });
    } else {
      setStatus({ kind: "err", text: "That shortcut couldn't be registered. Try another combination." });
    }
  };

  const testMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setStatus({ kind: "ok", text: "Microphone works." });
    } catch {
      setStatus({ kind: "err", text: "Microphone access was denied. Check Windows privacy settings for microphone." });
    }
  };

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center text-ink/60">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!prefs.onboarded) {
    return (
      <Onboarding
        prefs={prefs}
        signedIn={!!me}
        lastDictation={last}
        onUpdate={update}
        onFinish={() => update({ onboarded: true })}
      />
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-5 overflow-y-auto p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Mic className="size-5" /> Shunbo
        </div>
        <div className="flex items-center gap-2 text-sm">
          {me && (
            <>
              <span className="text-ink/60">{me.user.email}</span>
              <span className="rounded-pill bg-ink px-2.5 py-1 text-xs text-cream">{me.plan.name}</span>
              <button type="button" onClick={signOut} className="inline-flex items-center gap-1 rounded-pill border border-ink/15 px-3 py-1.5 text-xs">
                <LogOut className="size-3.5" /> Sign out
              </button>
            </>
          )}
          <button type="button" title="Diagnostics" onClick={async () => setDiag(diag ? null : await invoke("diagnostics"))} className="inline-flex items-center gap-1 rounded-pill border border-ink/15 px-3 py-1.5 text-xs">
            <Bug className="size-3.5" /> {diag ? "Hide" : "Diagnostics"}
          </button>
          <button type="button" title="Quit Shunbo completely" onClick={() => invoke("quit_app")} className="inline-flex items-center gap-1 rounded-pill border border-ink/15 px-3 py-1.5 text-xs text-coral">
            <Power className="size-3.5" /> Quit
          </button>
        </div>
      </header>

      {diag && (
        <section className="rounded-3xl border border-ink/10 bg-cream-2 p-5 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Diagnostics</h2>
            <button
              type="button"
              onClick={async () => {
                await writeText([`Shunbo ${diag.version} (${diag.debug ? "debug" : "release"})`, `exe: ${diag.exe}`, `server: ${prefs.apiUrl}`, `signed in: ${!!prefs.token} ${prefs.email ?? ""}`, `shunbo:// opens: ${diag.scheme_target}`, `logs: ${diag.log_dir}`, "", diag.log_tail].join("\n"));
                setDiagCopied(true);
                setTimeout(() => setDiagCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1 rounded-pill border border-ink/15 px-3 py-1 text-xs"
            >
              {diagCopied ? <Check className="size-3 text-forest" /> : <Copy className="size-3" />} {diagCopied ? "Copied" : "Copy report"}
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1 break-all">
            <dt className="text-ink/60">Version</dt><dd>{diag.version} ({diag.debug ? "debug" : "release"})</dd>
            <dt className="text-ink/60">Executable</dt><dd>{diag.exe}</dd>
            <dt className="text-ink/60">Server</dt><dd>{prefs.apiUrl}</dd>
            <dt className="text-ink/60">Signed in</dt><dd>{prefs.token ? `yes (${prefs.email ?? "…"})` : "no"}</dd>
            <dt className="text-ink/60">shunbo:// opens</dt><dd className={diag.scheme_target.toLowerCase().includes(diag.exe.toLowerCase()) ? "text-forest" : "text-coral"}>{diag.scheme_target}</dd>
            <dt className="text-ink/60">Log folder</dt><dd>{diag.log_dir}</dd>
          </dl>
          {!diag.scheme_target.toLowerCase().includes(diag.exe.toLowerCase()) && (
            <p className="mt-3 rounded-lg bg-coral/10 p-2 text-coral">Sign-in links open a different program than this one. Reinstall Shunbo to fix the registration.</p>
          )}
          <button type="button" onClick={() => update({ onboarded: false })} className="mt-3 rounded-pill border border-ink/15 px-3 py-1 text-xs">Run setup again</button>
          <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-ink p-3 font-mono text-[10px] leading-relaxed text-cream/90 whitespace-pre-wrap">{diag.log_tail || "(no log entries yet)"}</pre>
        </section>
      )}

      {status && (
        <p className={`flex items-center gap-2 rounded-xl p-3 text-sm ${status.kind === "err" ? "bg-coral/10 text-coral" : status.kind === "ok" ? "bg-mint/20 text-forest" : "bg-lavender"}`}>
          {status.kind === "err" ? <AlertCircle className="size-4" /> : status.kind === "ok" ? <Check className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
          {status.text}
        </p>
      )}

      {me && (
        <div className="inline-flex self-start rounded-pill border border-ink/15 bg-cream-2 p-1 text-sm">
          {(["dictate", "notetaker"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-pill px-4 py-1.5 capitalize ${tab === t ? "bg-ink text-cream" : "text-ink/60"}`}>
              {t === "dictate" ? "Dictate" : "Notetaker"}
            </button>
          ))}
        </div>
      )}

      {me && tab === "notetaker" ? (
        <Notetaker
          prefs={prefs}
          onConsent={() => update({ notetakerConsent: true })}
          remainingMinutes={me.meetingMinutesLimit === null ? null : Math.max(0, me.meetingMinutesLimit - me.meetingMinutesUsed)}
        />
      ) : !me ? (
        <section className="rounded-3xl border border-ink/10 bg-cream-2 p-6">
          <h1 className="display text-3xl">Sign in to start dictating</h1>
          <p className="mt-2 text-sm text-ink/65">We&rsquo;ll open your browser to connect this computer to your Shunbo account.</p>
          <button
            type="button"
            onClick={() => openUrl(`${prefs.apiUrl}/desktop/auth`)}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-pill border border-ink/80 bg-lavender px-5 text-sm font-medium shadow-[0_2px_0_0_rgba(26,26,26,0.8)]"
          >
            <ExternalLink className="size-4" /> Sign in with browser
          </button>
          <details className="mt-5 text-sm">
            <summary className="cursor-pointer text-ink/60">Browser didn&rsquo;t come back? Paste the code instead</summary>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (manualToken.trim()) applyToken(manualToken);
              }}
            >
              <input value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="shb_…" className="h-10 flex-1 rounded-xl border border-ink/15 bg-cream px-3 text-sm" />
              <button type="submit" className="h-10 rounded-pill bg-ink px-4 text-xs text-cream">Connect</button>
            </form>
          </details>
          <div className="mt-5 border-t border-ink/10 pt-4">
            <label className="text-xs text-ink/55">Server URL</label>
            <input value={prefs.apiUrl} onChange={(e) => update({ apiUrl: e.target.value })} className="mt-1 h-9 w-full rounded-xl border border-ink/15 bg-cream px-3 text-sm" />
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-ink/10 bg-forest p-6 text-cream">
            <div className="flex items-center gap-2 text-sm text-cream/70"><Keyboard className="size-4" /> Hold to talk</div>
            <div className="display mt-2 text-3xl">{prefs.shortcut.replace("CommandOrControl", "Ctrl")}</div>
            <p className="mt-2 text-sm text-cream/70">Hold the shortcut anywhere, speak, release. Polished text is pasted where your cursor is.</p>
            {shortcutOk === false && <p className="mt-2 text-sm text-coral">Shortcut not active. Change it below.</p>}
            {me.limit !== null && (
              <p className="mt-3 text-xs text-cream/60">{Math.max(0, me.limit - me.used).toLocaleString()} of {me.limit.toLocaleString()} words left this week.</p>
            )}
            {last && (
              <div className="mt-4 rounded-2xl bg-cream/10 p-3 text-sm">
                <div className="text-[11px] uppercase tracking-wider text-cream/50">Last dictation</div>
                <p className="mt-1 line-clamp-3">{last}</p>
              </div>
            )}
          </section>

          <section className="grid gap-4 rounded-3xl border border-ink/10 bg-cream-2 p-6 sm:grid-cols-2">
            <div>
              <label className="text-xs text-ink/55">Default tone</label>
              <div className="mt-1.5 inline-flex rounded-pill border border-ink/15 bg-cream p-0.5 text-xs">
                {TONES.map((t) => (
                  <button key={t.value} type="button" onClick={() => update({ tone: t.value })} className={`rounded-pill px-3 py-1.5 ${prefs.tone === t.value ? "bg-lavender border border-ink/15" : "text-ink/60"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              {server && server.presets.length > 0 && (
                <p className="mt-2 text-xs text-ink/50">{server.presets.length} app preset{server.presets.length === 1 ? "" : "s"} active: {server.presets.map((p) => p.context).join(", ")}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-ink/55">Language</label>
              <select value={prefs.language} onChange={(e) => update({ language: e.target.value })} className="mt-1.5 h-9 w-full rounded-xl border border-ink/15 bg-cream px-3 text-sm">
                {LANGUAGES.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-ink/55">After dictating</label>
              <select value={prefs.pasteMode} onChange={(e) => update({ pasteMode: e.target.value as Prefs["pasteMode"] })} className="mt-1.5 h-9 w-full rounded-xl border border-ink/15 bg-cream px-3 text-sm">
                <option value="paste">Paste into the active app</option>
                <option value="clipboard">Copy to clipboard only</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-ink/55">Shortcut</label>
              <div className="mt-1.5 flex gap-2">
                <input value={shortcutDraft} onChange={(e) => setShortcutDraft(e.target.value)} className="h-9 flex-1 rounded-xl border border-ink/15 bg-cream px-3 text-sm" />
                <button type="button" onClick={saveShortcut} className="h-9 rounded-pill bg-ink px-3 text-xs text-cream">Save</button>
              </div>
              <p className="mt-1 text-[11px] text-ink/45">e.g. CommandOrControl+Shift+Space, Alt+Space</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="button" onClick={testMic} className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-ink/15 px-3 text-xs"><Mic className="size-3.5" /> Test microphone</button>
              <button type="button" onClick={() => refreshAccount(prefs)} className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-ink/15 px-3 text-xs"><RefreshCw className="size-3.5" /> Refresh vocabulary and presets</button>
              <button type="button" onClick={() => openUrl(`${prefs.apiUrl}/settings`)} className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-ink/15 px-3 text-xs"><ExternalLink className="size-3.5" /> Manage account</button>
            </div>
          </section>
        </>
      )}
      <p className="text-center text-[11px] text-ink/40">Closing this window asks whether to keep Shunbo in the tray or quit.</p>
    </div>
  );
}
