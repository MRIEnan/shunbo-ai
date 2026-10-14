import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { error as logError, info as logInfo } from "@tauri-apps/plugin-log";
import { Mic, Speaker, Keyboard, ShieldCheck, Check, Loader2, AlertCircle, ExternalLink, ArrowRight, Monitor } from "lucide-react";
import type { Prefs } from "@/lib/store";

type Step = "welcome" | "signin" | "mic" | "system" | "shortcut" | "consent" | "done";
const ORDER: Step[] = ["welcome", "signin", "mic", "system", "shortcut", "consent", "done"];

type Props = {
  prefs: Prefs;
  signedIn: boolean;
  lastDictation: string | null;
  onUpdate: (patch: Partial<Prefs>) => Promise<void>;
  onFinish: () => void;
  onToken: (token: string) => Promise<void>;
};

/**
 * First-run wizard. Each check is real: the mic step triggers the Windows permission prompt,
 * the system-audio step plays a tone and confirms loopback heard it, the shortcut step waits
 * for an actual dictation to come through.
 */
export function Onboarding({ prefs, signedIn, lastDictation, onUpdate, onFinish, onToken }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [micState, setMicState] = useState<"idle" | "testing" | "ok" | "blocked" | "none">("idle");
  const [micLevel, setMicLevel] = useState(0);
  const [sysState, setSysState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [sysDetail, setSysDetail] = useState("");
  const [shortcutSeen, setShortcutSeen] = useState(false);
  const [openErr, setOpenErr] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const signInUrl = `${prefs.apiUrl}/desktop/auth`;

  const openSignIn = async () => {
    setOpenErr(null);
    try {
      await openUrl(signInUrl);
      logInfo(`opened browser for sign-in: ${signInUrl}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(`openUrl failed: ${msg}`);
      setOpenErr(msg);
    }
  };
  const raf = useRef<number | null>(null);
  const stream = useRef<MediaStream | null>(null);

  const idx = ORDER.indexOf(step);
  const next = () => setStep(ORDER[Math.min(ORDER.length - 1, idx + 1)]);

  // Move past sign-in automatically once the deep link lands.
  useEffect(() => {
    if (step === "signin" && signedIn) setStep("mic");
  }, [signedIn, step]);

  // The shortcut step completes when a dictation actually arrives.
  useEffect(() => {
    if (step === "shortcut" && lastDictation) setShortcutSeen(true);
  }, [lastDictation, step]);

  useEffect(() => () => stopMic(), []);

  const stopMic = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  const testMic = async () => {
    setMicState("testing");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(128);
      let peak = 0;
      const started = performance.now();
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const lvl = Math.min(1, Math.sqrt(sum / buf.length) * 4);
        peak = Math.max(peak, lvl);
        setMicLevel(lvl);
        if (performance.now() - started < 4000) raf.current = requestAnimationFrame(tick);
        else {
          ctx.close().catch(() => {});
          stopMic();
          setMicState(peak > 0.02 ? "ok" : "none");
        }
      };
      raf.current = requestAnimationFrame(tick);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setMicState(name === "NotAllowedError" || name === "SecurityError" ? "blocked" : "none");
    }
  };

  const testSystem = async () => {
    setSysState("testing");
    setSysDetail("");
    try {
      const info = await invoke<{ mic: string; system: string }>("meeting_capture_start");
      // Play a quiet tone through the webview so the loopback capture has something to hear.
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.08;
      osc.frequency.value = 440;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      await new Promise((r) => setTimeout(r, 2500));
      osc.stop();
      await ctx.close();
      const wav = await invoke<ArrayBuffer>("meeting_capture_take", { track: "system" });
      await invoke("meeting_capture_stop");
      const samples = new Int16Array(wav.slice(44));
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += (samples[i] / 32768) ** 2;
      const rms = Math.sqrt(sum / Math.max(1, samples.length));
      setSysDetail(`${info.system} · ${(samples.length / 16000).toFixed(1)}s captured`);
      setSysState(rms > 0.01 ? "ok" : "fail");
    } catch (e) {
      await invoke("meeting_capture_stop").catch(() => {});
      setSysDetail(e instanceof Error ? e.message : String(e));
      setSysState("fail");
    }
  };

  const Dots = () => (
    <div className="flex gap-1.5">
      {ORDER.slice(0, -1).map((s, i) => (
        <span key={s} className={`h-1.5 rounded-pill transition-all ${i === idx ? "w-6 bg-ink" : i < idx ? "w-3 bg-forest" : "w-3 bg-ink/15"}`} />
      ))}
    </div>
  );

  const Primary = ({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex h-11 items-center gap-2 rounded-pill border border-ink/80 bg-lavender px-5 text-sm font-medium shadow-[0_2px_0_0_rgba(26,26,26,0.8)] disabled:opacity-50">
      {children}
    </button>
  );
  const Skip = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick} className="text-sm text-ink/60 underline">Skip for now</button>
  );

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col justify-center gap-6 p-8">
      <Dots />

      {step === "welcome" && (
        <section>
          <h1 className="display text-4xl">Welcome to Shunbo</h1>
          <p className="mt-3 text-ink/70">Two things in one app: hold a key to dictate polished text anywhere, and record meetings for transcripts and notes.</p>
          <ul className="mt-5 flex flex-col gap-3 text-sm">
            <li className="flex gap-3"><Mic className="mt-0.5 size-4 shrink-0 text-forest" /> <span><strong>Microphone</strong> for your voice.</span></li>
            <li className="flex gap-3"><Speaker className="mt-0.5 size-4 shrink-0 text-forest" /> <span><strong>System audio</strong> so Notetaker hears the other side of a call.</span></li>
            <li className="flex gap-3"><Keyboard className="mt-0.5 size-4 shrink-0 text-forest" /> <span><strong>A global shortcut</strong> and typing into whichever app is active.</span></li>
          </ul>
          <p className="mt-4 text-xs text-ink/60">We&rsquo;ll check each of these now. Nothing is recorded until you hold the shortcut or start a meeting.</p>
          <div className="mt-6"><Primary onClick={next}>Get started <ArrowRight className="size-4" /></Primary></div>
        </section>
      )}

      {step === "signin" && (
        <section>
          <h1 className="display text-4xl">Sign in</h1>
          <p className="mt-3 text-ink/70">We&rsquo;ll open your browser. Sign in or create an account there, click Connect, and come back here.</p>
          <div className="mt-6 flex items-center gap-3">
            <Primary onClick={openSignIn}><ExternalLink className="size-4" /> Open browser to sign in</Primary>
            {signedIn ? <span className="inline-flex items-center gap-1 text-sm text-forest"><Check className="size-4" /> Connected</span> : <span className="inline-flex items-center gap-1 text-sm text-ink/60"><Loader2 className="size-4 animate-spin" /> Waiting…</span>}
          </div>
          {openErr && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-coral/10 p-3 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0 text-coral" /><span>Couldn&rsquo;t open your browser ({openErr}). Open this address yourself: <code className="select-text">{signInUrl}</code></span></p>
          )}
          <details className="mt-4 text-sm" open={!!openErr}>
            <summary className="cursor-pointer text-ink/60">Browser didn&rsquo;t open or didn&rsquo;t come back? Do it manually</summary>
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-ink/60">
                <code className="select-text break-all">{signInUrl}</code>
                <button type="button" className="rounded-pill border border-ink/15 px-2 py-0.5" onClick={async () => { await writeText(signInUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500); }}>{linkCopied ? "Copied" : "Copy link"}</button>
              </div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manualToken.trim()) onToken(manualToken.trim()); }}>
                <input value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="Paste the code from the sign-in page (shb_…)" className="h-10 flex-1 rounded-xl border border-ink/15 bg-cream px-3 text-sm" />
                <button type="submit" className="h-10 rounded-pill bg-ink px-4 text-xs text-cream">Connect</button>
              </form>
            </div>
          </details>
          <p className="mt-4 text-xs text-ink/60">Server: {prefs.apiUrl}. Change it from the main screen if your Shunbo runs elsewhere.</p>
        </section>
      )}

      {step === "mic" && (
        <section>
          <h1 className="display text-4xl">Microphone</h1>
          <p className="mt-3 text-ink/70">Windows will ask for microphone access the first time. Say a few words when the meter appears.</p>
          <div className="mt-5 h-2 overflow-hidden rounded-pill bg-ink/10"><div className="h-full rounded-pill bg-forest transition-[width] duration-75" style={{ width: `${Math.round(micLevel * 100)}%` }} /></div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {micState !== "ok" && <Primary onClick={testMic} disabled={micState === "testing"}>{micState === "testing" ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />} {micState === "testing" ? "Listening for 4 seconds…" : "Test microphone"}</Primary>}
            {micState === "ok" && <><span className="inline-flex items-center gap-1 text-sm text-forest"><Check className="size-4" /> Microphone works</span><Primary onClick={next}>Continue <ArrowRight className="size-4" /></Primary></>}
            {micState !== "ok" && <Skip onClick={next} />}
          </div>
          {micState === "blocked" && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-coral/10 p-3 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0 text-coral" /><span>Microphone access is blocked. Open Windows settings, turn on &ldquo;Let desktop apps access your microphone&rdquo;, then test again. <button type="button" className="underline" onClick={() => openUrl("ms-settings:privacy-microphone")}>Open microphone settings</button></span></p>
          )}
          {micState === "none" && <p className="mt-4 rounded-xl bg-coral/10 p-3 text-sm">We didn&rsquo;t hear anything. Check the mic is plugged in and not muted, then try again.</p>}
        </section>
      )}

      {step === "system" && (
        <section>
          <h1 className="display text-4xl">System audio</h1>
          <p className="mt-3 text-ink/70">Notetaker records what you hear so it can transcribe the other people on a call. We&rsquo;ll play a short tone and check that it was captured.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {sysState !== "ok" && <Primary onClick={testSystem} disabled={sysState === "testing"}>{sysState === "testing" ? <Loader2 className="size-4 animate-spin" /> : <Speaker className="size-4" />} {sysState === "testing" ? "Playing tone…" : "Test system audio"}</Primary>}
            {sysState === "ok" && <><span className="inline-flex items-center gap-1 text-sm text-forest"><Check className="size-4" /> System audio works</span><Primary onClick={next}>Continue <ArrowRight className="size-4" /></Primary></>}
            {sysState !== "ok" && <Skip onClick={next} />}
          </div>
          {sysDetail && <p className="mt-3 text-xs text-ink/60">{sysDetail}</p>}
          {sysState === "fail" && <p className="mt-3 rounded-xl bg-coral/10 p-3 text-sm">Nothing was captured. Make sure a speaker or headphones is set as the default output device and the volume isn&rsquo;t muted, then try again.</p>}
        </section>
      )}

      {step === "shortcut" && (
        <section>
          <h1 className="display text-4xl">Try the shortcut</h1>
          <p className="mt-3 text-ink/70">Click into the box below, hold <strong>{prefs.shortcut.replace("CommandOrControl", "Ctrl")}</strong>, say something, and let go. Your words should appear in the box.</p>
          <textarea className="mt-5 h-28 w-full rounded-xl border border-ink/15 bg-cream p-3 text-sm" placeholder="Click here, then hold the shortcut and speak…" />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {shortcutSeen ? <><span className="inline-flex items-center gap-1 text-sm text-forest"><Check className="size-4" /> It works</span><Primary onClick={next}>Continue <ArrowRight className="size-4" /></Primary></> : <Skip onClick={next} />}
          </div>
          {!shortcutSeen && !signedIn && <p className="mt-3 text-xs text-coral">You need to be signed in for dictation to work.</p>}
        </section>
      )}

      {step === "consent" && (
        <section>
          <h1 className="display text-4xl">Recording meetings</h1>
          <p className="mt-3 text-ink/70">Notetaker records your microphone and everything you hear. Depending on where you and the other participants are, you may need their consent. By continuing you agree to let people know when you record.</p>
          <p className="mt-3 text-sm text-ink/70">Audio is transcribed and discarded. Transcripts and notes stay in your account and can be deleted anytime.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Primary onClick={async () => { await onUpdate({ notetakerConsent: true }); next(); }}><ShieldCheck className="size-4" /> I understand</Primary>
            <Skip onClick={next} />
          </div>
        </section>
      )}

      {step === "done" && (
        <section>
          <h1 className="display text-4xl">You&rsquo;re set</h1>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            <li className="flex items-center gap-2"><Monitor className="size-4 text-forest" /> Shunbo lives in the tray. Closing the window asks whether to keep it running.</li>
            <li className="flex items-center gap-2"><Keyboard className="size-4 text-forest" /> Hold {prefs.shortcut.replace("CommandOrControl", "Ctrl")} anywhere to dictate.</li>
            <li className="flex items-center gap-2"><Speaker className="size-4 text-forest" /> Open the Notetaker tab to record a meeting.</li>
          </ul>
          <div className="mt-6"><Primary onClick={onFinish}>Open Shunbo <ArrowRight className="size-4" /></Primary></div>
          <p className="mt-3 text-xs text-ink/60">You can run this setup again from the Diagnostics panel.</p>
        </section>
      )}
    </div>
  );
}
