/**
 * Browser meeting recorder engine (no React inside).
 * Records two tracks, the shared tab's audio ("system") and the microphone ("mic"),
 * as independent ~4-minute files that are uploaded as soon as each one ends.
 */
export type Track = "mic" | "system";
export type RecorderEvents = {
  onLevels: (levels: Record<Track, number>) => void;
  onElapsed: (sec: number) => void;
  onUpload: (delta: { sent?: number; failed?: number; pending?: number }) => void;
  onEnded: () => void; // the user stopped sharing from the browser UI
  onLimit?: (message: string) => void; // the server ended the meeting (allowance or 4-hour ceiling); stop recording
};

const CHUNK_MS = 4 * 60 * 1000;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export class MeetingRecorder {
  private streams: Record<Track, MediaStream | null> = { mic: null, system: null };
  private recorders: Partial<Record<Track, MediaRecorder>> = {};
  private chunkIndex: Record<Track, number> = { mic: 0, system: 0 };
  private startedAt = 0;
  private pausedTotal = 0;
  private pausedAt = 0;
  private rotateTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private raf: number | null = null;
  private ctx: AudioContext | null = null;
  private pending = 0;
  private limitHit = false;
  meetingId: string | null = null;

  constructor(private events: RecorderEvents) {}

  static supported() {
    return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== "undefined";
  }

  elapsedSec() {
    if (!this.startedAt) return 0;
    const pausedNow = this.pausedAt ? performance.now() - this.pausedAt : 0;
    return (performance.now() - this.startedAt - this.pausedTotal - pausedNow) / 1000;
  }

  /** Acquires tab audio + mic. Throws with a user-facing message on failure. */
  async acquire() {
    const system = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    system.getVideoTracks().forEach((t) => t.stop());
    if (system.getAudioTracks().length === 0) {
      system.getTracks().forEach((t) => t.stop());
      throw new Error('No tab audio was shared. Choose a browser tab and tick "Share tab audio".');
    }
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    this.streams = { mic, system };
    system.getAudioTracks()[0].addEventListener("ended", () => this.events.onEnded());
  }

  start(meetingId: string) {
    this.meetingId = meetingId;
    this.startedAt = performance.now();
    this.pausedTotal = 0;
    this.pausedAt = 0;
    this.chunkIndex = { mic: 0, system: 0 };
    this.limitHit = false;
    this.startRecorder("mic");
    this.startRecorder("system");
    this.rotateTimer = setInterval(() => this.rotate(), CHUNK_MS);
    this.tickTimer = setInterval(() => this.events.onElapsed(this.elapsedSec()), 500);
    this.meter();
  }

  pause() {
    for (const r of Object.values(this.recorders)) if (r?.state === "recording") r.pause();
    this.pausedAt = performance.now();
  }

  resume() {
    if (this.pausedAt) this.pausedTotal += performance.now() - this.pausedAt;
    this.pausedAt = 0;
    for (const r of Object.values(this.recorders)) if (r?.state === "paused") r.resume();
  }

  /** Stops capture, waits for in-flight uploads, returns the total duration. */
  async stop(): Promise<number> {
    const duration = this.elapsedSec();
    this.stopRecorders();
    this.teardown();
    for (let i = 0; i < 120 && this.pending > 0; i++) await new Promise((r) => setTimeout(r, 500));
    return duration;
  }

  abort() {
    this.stopRecorders(false);
    this.teardown();
  }

  private startRecorder(track: Track) {
    const stream = this.streams[track];
    if (!stream || stream.getAudioTracks().length === 0) return;
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64_000 } : undefined);
    const parts: Blob[] = [];
    const index = this.chunkIndex[track]++;
    const offset = this.elapsedSec();
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) parts.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(parts, { type: rec.mimeType || "audio/webm" });
      this.upload(track, index, blob, offset, Math.max(0, this.elapsedSec() - offset));
    };
    rec.start();
    this.recorders[track] = rec;
  }

  private stopRecorders(upload = true) {
    for (const t of ["mic", "system"] as Track[]) {
      const r = this.recorders[t];
      if (r && r.state !== "inactive") {
        if (!upload) r.onstop = null;
        r.stop();
      }
      delete this.recorders[t];
    }
  }

  private rotate() {
    if (this.pausedAt) return;
    this.stopRecorders();
    this.startRecorder("mic");
    this.startRecorder("system");
  }

  private async upload(track: Track, index: number, blob: Blob, offsetSec: number, durationSec: number) {
    if (!this.meetingId || blob.size < 1000 || this.limitHit) return;
    this.pending++;
    this.events.onUpload({ pending: 1 });
    const fd = new FormData();
    fd.append("audio", blob, `${track}-${index}.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
    fd.append("index", String(index));
    fd.append("track", track);
    fd.append("offsetSec", String(offsetSec));
    fd.append("durationSec", String(durationSec));
    let ok = false;
    try {
      const res = await fetch(`/api/meetings/${this.meetingId}/chunks`, { method: "POST", body: fd });
      ok = res.ok;
      if (res.status === 402 || res.status === 409) {
        // The server ended the meeting: nothing more will be accepted.
        const data = await res.json().catch(() => ({}));
        if (!this.limitHit) {
          this.limitHit = true;
          this.events.onLimit?.(data.error ?? "The meeting was ended by the server.");
        }
      }
    } catch {
      ok = false;
    }
    this.pending--;
    this.events.onUpload({ pending: -1, sent: ok ? 1 : 0, failed: ok ? 0 : 1 });
  }

  private meter() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const analysers: Partial<Record<Track, AnalyserNode>> = {};
    for (const t of ["mic", "system"] as Track[]) {
      const s = this.streams[t];
      if (!s || s.getAudioTracks().length === 0) continue;
      const a = ctx.createAnalyser();
      a.fftSize = 256;
      ctx.createMediaStreamSource(s).connect(a);
      analysers[t] = a;
    }
    const buf = new Uint8Array(128);
    const tick = () => {
      const next: Record<Track, number> = { mic: 0, system: 0 };
      for (const t of ["mic", "system"] as Track[]) {
        const a = analysers[t];
        if (!a) continue;
        a.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        next[t] = Math.min(1, Math.sqrt(sum / buf.length) * 4);
      }
      this.events.onLevels(next);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private teardown() {
    if (this.rotateTimer) clearInterval(this.rotateTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.rotateTimer = this.tickTimer = null;
    this.raf = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    for (const t of ["mic", "system"] as Track[]) {
      this.streams[t]?.getTracks().forEach((x) => x.stop());
      this.streams[t] = null;
    }
  }
}
