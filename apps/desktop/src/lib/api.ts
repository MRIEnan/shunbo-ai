import type { Prefs, Tone } from "./store";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export type Snippet = { trigger: string; expansion: string };
export type Preset = { context: string; tone: Tone; instructions: string };
export type ServerSettings = {
  settings: { tone: Tone; language: string; autoCopy: boolean };
  vocabulary: { id: string; word: string }[];
  snippets: Snippet[];
  presets: Preset[];
};
export type Me = {
  user: { id: string; email: string };
  plan: { slug: string; name: string };
  used: number;
  limit: number | null;
  overLimit: boolean;
  meetingMinutesUsed: number;
  meetingMinutesLimit: number | null;
};

export function makeApi(prefs: Pick<Prefs, "apiUrl" | "token">) {
  const base = prefs.apiUrl.replace(/\/$/, "");
  const headers = (extra: Record<string, string> = {}) => ({
    ...(prefs.token ? { Authorization: `Bearer ${prefs.token}` } : {}),
    ...extra,
  });

  async function parse<T>(res: Response): Promise<T> {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.code);
    return data as T;
  }

  return {
    me: () => fetch(`${base}/api/me`, { headers: headers() }).then((r) => parse<Me>(r)),
    settings: () => fetch(`${base}/api/settings`, { headers: headers() }).then((r) => parse<ServerSettings>(r)),
    async transcribe(blob: Blob, language: string, vocabulary: string[]) {
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      fd.append("audio", blob, `dictation.${ext}`);
      fd.append("language", language);
      fd.append("vocabulary", vocabulary.join(","));
      const res = await fetch(`${base}/api/transcribe`, { method: "POST", headers: headers(), body: fd });
      return (await parse<{ text: string }>(res)).text;
    },
    async clean(raw: string, tone: Tone, vocabulary: string[], snippets: Snippet[], instructions = "") {
      const res = await fetch(`${base}/api/clean`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ raw, tone, vocabulary, snippets, instructions }),
      });
      return (await parse<{ text: string }>(res)).text;
    },
    async save(raw: string, clean: string, tone: Tone, durationSec: number, language: string) {
      const res = await fetch(`${base}/api/dictations`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ raw, clean, tone, durationSec, language, source: "desktop" }),
      });
      return parse<{ item: { id: string } }>(res);
    },
    async meetingStart(title: string, language: string) {
      const res = await fetch(`${base}/api/meetings`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title, language, source: "desktop" }),
      });
      return parse<{ item: { id: string; title: string }; remainingMinutes: number | null }>(res);
    },
    async meetingChunk(meetingId: string, track: "mic" | "system", index: number, wav: ArrayBuffer, offsetSec: number, durationSec: number) {
      const fd = new FormData();
      fd.append("audio", new Blob([wav], { type: "audio/wav" }), `${track}-${index}.wav`);
      fd.append("index", String(index));
      fd.append("track", track);
      fd.append("offsetSec", String(offsetSec));
      fd.append("durationSec", String(durationSec));
      const res = await fetch(`${base}/api/meetings/${meetingId}/chunks`, { method: "POST", headers: headers(), body: fd });
      return parse<{ ok: true; segments: number }>(res);
    },
    async meetingFinish(meetingId: string, durationSec: number) {
      const res = await fetch(`${base}/api/meetings/${meetingId}/finish`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ durationSec }),
      });
      return parse<{ ok: true; status: string }>(res);
    },
    revokeToken: () => fetch(`${base}/api/tokens`, { method: "DELETE", headers: headers({ "Content-Type": "application/json" }), body: "{}" }).catch(() => null),
  };
}
