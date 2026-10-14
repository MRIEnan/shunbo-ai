"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mic, MonitorUp, Square, Pause, Play, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { MeetingRecorder, type Track } from "@/lib/meeting-recorder";
import { cn } from "@/lib/cn";

type Phase = "idle" | "starting" | "recording" | "paused" | "finishing";
const CONSENT_KEY = "shunbo.notetaker.consent";
const consentListeners = new Set<() => void>();
const readConsent = () => {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
};
const subscribeConsent = (cb: () => void) => {
  consentListeners.add(cb);
  return () => consentListeners.delete(cb);
};
const grantConsent = () => {
  try {
    localStorage.setItem(CONSENT_KEY, "1");
  } catch {
    /* ignore */
  }
  consentListeners.forEach((cb) => cb());
};

export function WebRecorder({ remainingMinutes }: { remainingMinutes: number | null }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [title, setTitle] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<Record<Track, number>>({ mic: 0, system: 0 });
  const [uploads, setUploads] = useState({ sent: 0, failed: 0, pending: 0 });
  const [error, setError] = useState<string | null>(null);
  const consented = useSyncExternalStore(subscribeConsent, readConsent, () => false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [supported] = useState(() => MeetingRecorder.supported());
  const engine = useRef<MeetingRecorder | null>(null);
  const phaseRef = useRef<Phase>("idle");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const finish = async () => {
    const e = engine.current;
    if (!e || !e.meetingId || phaseRef.current === "finishing") return;
    setPhase("finishing");
    const duration = await e.stop();
    await fetch(`/api/meetings/${e.meetingId}/finish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ durationSec: duration }) }).catch(() => null);
    router.push(`/meetings/${e.meetingId}`);
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  useEffect(() => {
    engine.current = new MeetingRecorder({
      onLevels: setLevels,
      onElapsed: setElapsed,
      onUpload: (d) => setUploads((u) => ({ sent: u.sent + (d.sent ?? 0), failed: u.failed + (d.failed ?? 0), pending: u.pending + (d.pending ?? 0) })),
      onEnded: () => finishRef.current(),
      onLimit: (message) => {
        setError(message);
        finishRef.current();
      },
    });
    const e = engine.current;
    return () => e.abort();
  }, []);

  const start = async () => {
    const e = engine.current;
    if (!e) return;
    setError(null);
    setPhase("starting");
    try {
      await e.acquire();
      const res = await fetch("/api/meetings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim() || undefined, source: "web" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start meeting");
      setMeetingId(data.item.id);
      if (!title.trim()) setTitle(data.item.title);
      e.start(data.item.id);
      setPhase("recording");
    } catch (err) {
      e.abort();
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Couldn't start recording");
    }
  };

  const pause = () => {
    engine.current?.pause();
    setPhase("paused");
  };
  const resume = () => {
    engine.current?.resume();
    setPhase("recording");
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(Math.floor(elapsed % 60)).padStart(2, "0");

  if (!supported) {
    return <p className="rounded-xl border border-coral/40 bg-coral/10 p-4 text-sm">Your browser can&rsquo;t share tab audio. Use Chrome or Edge on desktop, or the Shunbo desktop app.</p>;
  }

  if (!consented) {
    return (
      <section className="max-w-xl rounded-card border border-ink/10 bg-cream-2 p-6">
        <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-forest" /> Before you record</div>
        <p className="mt-3 text-sm text-ink/70">
          Recording a conversation may require consent from everyone taking part, depending on where you and they are. By continuing you confirm you will let participants know they are being recorded. Audio is transcribed and then discarded; only the transcript and notes are stored in your account.
        </p>
        <button type="button" onClick={grantConsent} className="mt-4 inline-flex h-10 items-center rounded-pill bg-ink px-4 text-sm text-cream">
          I understand
        </button>
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <section className="rounded-card border border-ink/10 bg-cream-2 p-6">
        {error && (
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0 text-coral" />{error}</p>
        )}
        {remainingMinutes === 0 && phase === "idle" && (
          <p className="mb-4 rounded-xl bg-lavender p-3 text-sm">You&rsquo;ve used this month&rsquo;s meeting minutes. <Link href="/pricing" className="underline">Upgrade</Link> for unlimited Notetaker.</p>
        )}
        <label className="text-xs text-ink/60" htmlFor="meeting-title">Meeting title</label>
        <input id="meeting-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={phase !== "idle"} placeholder="e.g. Weekly sync with design" className="mt-1 h-10 w-full rounded-xl border border-ink/15 bg-cream px-3 text-sm" />

        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="display text-6xl tabular-nums">{mm}:{ss}</div>
          <div className="flex w-full max-w-sm flex-col gap-2 text-xs text-ink/60">
            <Level icon={<Mic className="size-3.5" />} label="You" value={levels.mic} active={phase === "recording"} />
            <Level icon={<MonitorUp className="size-3.5" />} label="Tab audio" value={levels.system} active={phase === "recording"} />
          </div>
          <div className="flex gap-2">
            {phase === "idle" && (
              <button type="button" onClick={start} disabled={remainingMinutes === 0} className="inline-flex h-12 items-center gap-2 rounded-pill bg-coral px-6 text-sm font-medium text-cream disabled:opacity-50">
                <span className="size-2.5 rounded-full bg-cream" /> Start recording
              </button>
            )}
            {phase === "starting" && <span className="inline-flex h-12 items-center gap-2 text-sm text-ink/60"><Loader2 className="size-4 animate-spin" /> Waiting for you to pick a tab…</span>}
            {(phase === "recording" || phase === "paused") && (
              <>
                <button type="button" onClick={phase === "recording" ? pause : resume} className="inline-flex h-12 items-center gap-2 rounded-pill border border-ink/20 px-5 text-sm">
                  {phase === "recording" ? <><Pause className="size-4" /> Pause</> : <><Play className="size-4" /> Resume</>}
                </button>
                <button type="button" onClick={finish} className="inline-flex h-12 items-center gap-2 rounded-pill bg-ink px-6 text-sm font-medium text-cream">
                  <Square className="size-4 fill-current" /> Stop and make notes
                </button>
              </>
            )}
            {phase === "finishing" && <span className="inline-flex h-12 items-center gap-2 text-sm text-ink/60"><Loader2 className="size-4 animate-spin" /> Finishing uploads and writing notes…</span>}
          </div>
          {phase !== "idle" && (
            <p className="text-xs text-ink/60">
              {uploads.sent} chunk{uploads.sent === 1 ? "" : "s"} transcribed{uploads.pending ? ` · ${uploads.pending} uploading` : ""}{uploads.failed ? ` · ${uploads.failed} failed` : ""}
              {meetingId && <> · <Link href={`/meetings/${meetingId}`} className="underline" target="_blank">live transcript</Link></>}
            </p>
          )}
        </div>
      </section>

      <aside className="rounded-card border border-ink/10 bg-cream-2 p-5 text-sm">
        <h2 className="font-medium">How it works</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-4 text-ink/70">
          <li>Open your call in another browser tab (Google Meet, a dial-in web client, etc.).</li>
          <li>Click Start recording, pick that tab in the picker, and tick <strong>Share tab audio</strong>.</li>
          <li>Allow the microphone. Keep this tab open while the call runs.</li>
          <li>Click Stop when the call ends. Notes are ready in under a minute.</li>
        </ol>
        <p className="mt-4 text-xs text-ink/60">Chunks of about four minutes are transcribed during the call, so a dropped connection loses at most a few minutes.</p>
        {remainingMinutes !== null && <p className="mt-2 text-xs text-ink/60">{remainingMinutes} minutes left this month.</p>}
      </aside>
    </div>
  );
}

function Level({ icon, label, value, active }: { icon: React.ReactNode; label: string; value: number; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-24 items-center gap-1.5">{icon} {label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-pill bg-ink/10">
        <div className={cn("h-full rounded-pill transition-[width] duration-75", active ? "bg-forest" : "bg-ink/20")} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}
