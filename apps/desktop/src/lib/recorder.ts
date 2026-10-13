/** Minimal MediaRecorder wrapper with an RMS level meter. Runs in the main (hidden) window. */
export class Recorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ctx: AudioContext | null = null;
  private raf: number | null = null;
  private startedAt = 0;
  onLevel: (level: number, elapsed: number) => void = () => {};

  get recording() {
    return this.rec?.state === "recording";
  }

  async start() {
    if (this.recording) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      this.onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4), (performance.now() - this.startedAt) / 1000);
      this.raf = requestAnimationFrame(tick);
    };
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.startedAt = performance.now();
    this.rec.start(250);
    this.raf = requestAnimationFrame(tick);
  }

  /** Resolves with the audio blob and duration in seconds (null blob if nothing was captured). */
  stop(): Promise<{ blob: Blob | null; duration: number }> {
    const rec = this.rec;
    const duration = (performance.now() - this.startedAt) / 1000;
    if (!rec || rec.state === "inactive") {
      this.cleanup();
      return Promise.resolve({ blob: null, duration });
    }
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
        this.cleanup();
        resolve({ blob: blob.size > 0 ? blob : null, duration });
      };
      rec.stop();
    });
  }

  cancel() {
    const rec = this.rec;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      rec.stop();
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.rec = null;
  }
}
