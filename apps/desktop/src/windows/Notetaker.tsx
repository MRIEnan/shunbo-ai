import { useEffect, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Mic, Speaker, Square, Pause, Play, Loader2, AlertCircle, ShieldCheck, ExternalLink } from "lucide-react";
import type { Prefs } from "@/lib/store";
import { makeApi, ApiError } from "@/lib/api";
import type { OverlayState } from "./Overlay";
import { info as logInfo, error as logError } from "@tauri-apps/plugin-log";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = "idle" | "starting" | "recording" | "paused" | "finishing";
type Track = "mic" | "system";
const CHUNK_SEC = 4 * 60;

type Props = { prefs: Prefs; onConsent: () => void; remainingMinutes: number | null };

export function Notetaker({ prefs, onConsent, remainingMinutes }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [title, setTitle] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState({ mic: 0, system: 0 });
  const [devices, setDevices] = useState<{ mic: string; system: string } | null>(null);
  const [uploads, setUploads] = useState({ sent: 0, failed: 0, pending: 0 });
  const [error, setError] = useState<string | null>(null);
  const [lastMeeting, setLastMeeting] = useState<string | null>(null);

  const meetingId = useRef<string | null>(null);
  const chunkIndex = useRef<Record<Track, number>>({ mic: 0, system: 0 });
  const chunkStart = useRef(0);
  const pending = useRef(0);
  const limitHit = useRef(false);
  const stopRef = useRef<() => Promise<void>>(async () => {});
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotate = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const overlay = (s: OverlayState) => emit("overlay", s);

  const uploadTrack = async (track: Track, offsetSec: number, durationSec: number) => {
    const id = meetingId.current;
    if (!id || limitHit.current) return;
    try {
      const wav = await invoke<ArrayBuffer>("meeting_capture_take", { track });
      if (wav.byteLength < 44 + 16_000 * 2) return; // under a second of audio: skip
      const index = chunkIndex.current[track]++;
      pending.current++;
      setUploads((u) => ({ ...u, pending: u.pending + 1 }));
      const api = makeApi(prefsRef.current);
      let ok = false;
      let lastErr = "";
      for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
        try {
          const r = await api.meetingChunk(id, track, index, wav, offsetSec, durationSec);
          ok = true;
          logInfo(`chunk ${track}#${index} (${(wav.byteLength / 1024).toFixed(0)} KB) transcribed: ${r.segments} segments`);
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          const fatal = e instanceof ApiError && [401, 402, 404, 409, 413].includes(e.status);
          logError(`chunk ${track}#${index} attempt ${attempt} failed: ${lastErr}`);
          if (e instanceof ApiError && (e.status === 402 || e.status === 409) && !limitHit.current) {
            // The server ended the meeting (monthly minutes or the 4-hour ceiling): stop recording and fetch the notes.
            limitHit.current = true;
            setError(e.status === 402 ? e.message : "The meeting was already ended on the server.");
            void stopRef.current();
          }
          if (fatal) break;
          await sleep(1500 * attempt);
        }
      }
      if (!ok && !limitHit.current) setError(`Upload failed for ${track} chunk ${index}: ${lastErr}`);
      pending.current--;
      setUploads((u) => ({ pending: u.pending - 1, sent: u.sent + (ok ? 1 : 0), failed: u.failed + (ok ? 0 : 1) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const flushChunks = async (nowSec: number) => {
    const offset = chunkStart.current;
    const duration = Math.max(0, nowSec - offset);
    chunkStart.current = nowSec;
    await Promise.all([uploadTrack("mic", offset, duration), uploadTrack("system", offset, duration)]);
  };

  const stopTimers = () => {
    if (poll.current) clearInterval(poll.current);
    if (rotate.current) clearInterval(rotate.current);
    poll.current = rotate.current = null;
  };

  const start = async () => {
    setError(null);
    setPhase("starting");
    const p = prefsRef.current;
    try {
      const api = makeApi(p);
      logInfo(`notetaker start requested (server ${p.apiUrl})`);
      const { item } = await api.meetingStart(title.trim() || `Meeting ${new Date().toLocaleString()}`, p.language);
      meetingId.current = item.id;
      logInfo(`meeting ${item.id} created`);
      if (!title.trim()) setTitle(item.title);
      const info = await invoke<{ mic: string; system: string }>("meeting_capture_start");
      logInfo(`capture started: mic="${info.mic}" system="${info.system}"`);
      setDevices(info);
      chunkIndex.current = { mic: 0, system: 0 };
      chunkStart.current = 0;
      limitHit.current = false;
      setUploads({ sent: 0, failed: 0, pending: 0 });
      poll.current = setInterval(async () => {
        const [mic, system, secs] = await invoke<[number, number, number]>("meeting_capture_levels");
        setLevels({ mic, system });
        setElapsed(secs);
        overlay({ state: "meeting", elapsed: secs });
      }, 150);
      rotate.current = setInterval(async () => {
        const [, , secs] = await invoke<[number, number, number]>("meeting_capture_levels");
        flushChunks(secs);
      }, CHUNK_SEC * 1000);
      setPhase("recording");
    } catch (e) {
      await invoke("meeting_capture_stop").catch(() => {});
      stopTimers();
      setPhase("idle");
      const msg = e instanceof ApiError && e.code === "quota_exceeded" ? e.message : e instanceof Error ? e.message : String(e);
      logError(`notetaker start failed: ${msg}`);
      setError(msg);
      overlay({ state: "idle" });
    }
  };

  const togglePause = async () => {
    const next = phase !== "paused";
    await invoke("meeting_capture_pause", { paused: next });
    setPhase(next ? "paused" : "recording");
  };

  const stop = async () => {
    if (phase === "finishing") return;
    setPhase("finishing");
    stopTimers();
    try {
      const [, , secs] = await invoke<[number, number, number]>("meeting_capture_levels");
      if (!limitHit.current) await flushChunks(secs);
      await invoke("meeting_capture_stop");
      overlay({ state: "polishing" });
      for (let i = 0; i < 120 && pending.current > 0; i++) await new Promise((r) => setTimeout(r, 500));
      const id = meetingId.current!;
      logInfo(`finishing meeting ${id} after ${secs.toFixed(0)}s`);
      await makeApi(prefsRef.current).meetingFinish(id, secs);
      logInfo(`meeting ${id} notes ready`);
      setLastMeeting(id);
      overlay({ state: "done", message: "Meeting notes ready" });
      setTimeout(() => overlay({ state: "idle" }), 2500);
    } catch (e) {
      logError(`notetaker stop failed: ${e instanceof Error ? e.message : String(e)}`);
      setError(e instanceof Error ? e.message : String(e));
      overlay({ state: "idle" });
    } finally {
      meetingId.current = null;
      setPhase("idle");
      setElapsed(0);
      setLevels({ mic: 0, system: 0 });
    }
  };

  stopRef.current = stop;

  useEffect(() => () => {
    stopTimers();
    invoke("meeting_capture_stop").catch(() => {});
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(Math.floor(elapsed % 60)).padStart(2, "0");

  if (!prefs.notetakerConsent) {
    return (
      <section className="rounded-3xl border border-ink/10 bg-cream-2 p-6">
        <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-forest" /> Before you record meetings</div>
        <p className="mt-3 text-sm text-ink/70">
          Notetaker records your microphone and everything you hear from this computer. Recording a conversation may require consent from everyone taking part. By continuing you confirm you will let participants know. Audio is transcribed and discarded; only transcripts and notes are kept in your account.
        </p>
        <button type="button" onClick={onConsent} className="mt-4 inline-flex h-10 items-center rounded-pill bg-ink px-4 text-sm text-cream">I understand</button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0 text-coral" />{error}</p>
      )}
      <section className="rounded-3xl border border-ink/10 bg-cream-2 p-6">
        <label className="text-xs text-ink/60" htmlFor="mtg-title">Meeting title</label>
        <input id="mtg-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={phase !== "idle"} placeholder="e.g. Weekly sync" className="mt-1 h-10 w-full rounded-xl border border-ink/15 bg-cream px-3 text-sm" />

        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="display text-6xl tabular-nums">{mm}:{ss}</div>
          <div className="flex w-full max-w-sm flex-col gap-2 text-xs text-ink/60">
            <Level icon={<Mic className="size-3.5" />} label={devices?.mic ?? "Microphone"} value={levels.mic} active={phase === "recording"} />
            <Level icon={<Speaker className="size-3.5" />} label={devices?.system ?? "System audio"} value={levels.system} active={phase === "recording"} />
          </div>
          <div className="flex gap-2">
            {phase === "idle" && (
              <button type="button" onClick={start} disabled={remainingMinutes === 0} className="inline-flex h-12 items-center gap-2 rounded-pill bg-coral px-6 text-sm font-medium text-cream disabled:opacity-50">
                <span className="size-2.5 rounded-full bg-cream" /> Start recording
              </button>
            )}
            {phase === "starting" && <span className="inline-flex h-12 items-center gap-2 text-sm text-ink/60"><Loader2 className="size-4 animate-spin" /> Opening audio devices…</span>}
            {(phase === "recording" || phase === "paused") && (
              <>
                <button type="button" onClick={togglePause} className="inline-flex h-12 items-center gap-2 rounded-pill border border-ink/20 px-5 text-sm">
                  {phase === "recording" ? <><Pause className="size-4" /> Pause</> : <><Play className="size-4" /> Resume</>}
                </button>
                <button type="button" onClick={stop} className="inline-flex h-12 items-center gap-2 rounded-pill bg-ink px-6 text-sm font-medium text-cream">
                  <Square className="size-4 fill-current" /> Stop and make notes
                </button>
              </>
            )}
            {phase === "finishing" && <span className="inline-flex h-12 items-center gap-2 text-sm text-ink/60"><Loader2 className="size-4 animate-spin" /> Uploading the last audio and writing notes…</span>}
          </div>
          {phase !== "idle" && (
            <p className="text-xs text-ink/60">
              {uploads.sent} chunk{uploads.sent === 1 ? "" : "s"} transcribed{uploads.pending ? ` · ${uploads.pending} uploading` : ""}{uploads.failed ? ` · ${uploads.failed} failed` : ""}
            </p>
          )}
          {remainingMinutes !== null && phase === "idle" && (
            <p className="text-xs text-ink/60">{remainingMinutes} meeting minutes left this month.</p>
          )}
        </div>
      </section>

      {lastMeeting && (
        <section className="flex items-center justify-between rounded-3xl border border-ink/10 bg-forest p-5 text-cream">
          <div>
            <div className="text-sm font-medium">Notes are ready</div>
            <div className="text-xs text-cream/70">Summary, action items and the full transcript are in your account.</div>
          </div>
          <button type="button" onClick={() => openUrl(`${prefs.apiUrl}/meetings/${lastMeeting}`)} className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-cream px-3 text-xs text-ink">
            <ExternalLink className="size-3.5" /> Open notes
          </button>
        </section>
      )}

      <p className="text-xs text-ink/60">
        Records the default microphone and the default output device. Works with Zoom, Teams, Meet, Slack and any other call on this PC. A red pill at the bottom of the screen shows while recording.
      </p>
    </div>
  );
}

function Level({ icon, label, value, active }: { icon: React.ReactNode; label: string; value: number; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-36 items-center gap-1.5 truncate">{icon} <span className="truncate">{label}</span></span>
      <div className="h-2 flex-1 overflow-hidden rounded-pill bg-ink/10">
        <div className={`h-full rounded-pill transition-[width] duration-75 ${active ? "bg-forest" : "bg-ink/20"}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}
