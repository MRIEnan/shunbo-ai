import { prisma } from "@/lib/prisma";
import { getOpenAI, CLEAN_MODEL } from "@/lib/openai";
import { LANGUAGE_INFO, detectByScript, isRomanized, isSupportedLanguage, languageEnglishName, whisperNameToCode } from "@/lib/languages";

export const DIARIZE_MODEL = "gpt-4o-transcribe-diarize";
export const FALLBACK_MODEL = "whisper-1";
export const PLAIN_MODEL = "gpt-4o-transcribe";

export type Segment = { speaker: string; startSec: number; endSec: number; text: string; language?: string | null };

type DiarizedResponse = { segments?: { speaker?: string; start?: number; end?: number; text?: string }[]; text?: string };
type VerboseResponse = { segments?: { start: number; end: number; text: string }[]; text?: string; language?: string };

const speakerLabel = (track: "mic" | "system", diarize: boolean) => (speaker: string | undefined, i: number) =>
  track === "mic" ? "You" : diarize ? `Speaker ${(speaker ?? String(i + 1)).replace(/^speaker[_\s]?/i, "")}` : "Others";

/**
 * Cheap one-off language detection on audio: whisper-1 reports the language it heard.
 * Returns the ISO code (if supported) plus whatever text it produced, so callers can skip near-silent chunks.
 */
export async function detectLanguageFromAudio(file: File): Promise<{ code: string | null; text: string; segments: VerboseResponse["segments"] }> {
  const res = (await getOpenAI().audio.transcriptions.create({
    model: FALLBACK_MODEL,
    file,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  })) as unknown as VerboseResponse;
  const text = res.text?.trim() ?? "";
  return { code: whisperNameToCode(res.language) ?? detectByScript(text), text, segments: res.segments };
}

/** Script check first (free); otherwise one small classification call. Null when undecidable. */
export async function classifyTextLanguage(text: string): Promise<string | null> {
  const sample = text.trim().slice(0, 1500);
  if (sample.length < 12) return null;
  const byScript = detectByScript(sample);
  if (byScript) return byScript;
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: CLEAN_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `Identify the dominant language of the text. Reply with JSON {"language": "<ISO-639-1 code>"} only. Allowed codes: ${Object.keys(LANGUAGE_INFO).join(", ")}. Romanized text (e.g. Bangla or Hindi written in Latin letters) still counts as that language.` },
        { role: "user", content: sample },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { language?: string };
    return isSupportedLanguage(parsed.language) ? parsed.language : null;
  } catch {
    return null;
  }
}

async function diarized(file: File, language: string | undefined): Promise<DiarizedResponse> {
  // The diarize model rejects `prompt`, so only the language hint is sent.
  return (await getOpenAI().audio.transcriptions.create({
    model: DIARIZE_MODEL,
    file,
    language,
    response_format: "diarized_json",
    chunking_strategy: "auto",
  })) as unknown as DiarizedResponse;
}

function diarizedToSegments(res: DiarizedResponse, track: "mic" | "system", diarize: boolean, offsetSec: number): Segment[] {
  const label = speakerLabel(track, diarize);
  if (res.segments?.length) {
    return res.segments
      .filter((s) => s.text?.trim())
      .map((s, i) => ({ speaker: label(s.speaker, i), startSec: offsetSec + (s.start ?? 0), endSec: offsetSec + (s.end ?? s.start ?? 0), text: s.text!.trim() }));
  }
  if (res.text?.trim()) return [{ speaker: label(undefined, 0), startSec: offsetSec, endSec: offsetSec, text: res.text.trim() }];
  return [];
}

function verboseToSegments(res: VerboseResponse, track: "mic" | "system", offsetSec: number): Segment[] {
  const who = track === "mic" ? "You" : "Others";
  return (res.segments ?? [])
    .filter((s) => s.text.trim())
    .map((s) => ({ speaker: who, startSec: offsetSec + s.start, endSec: offsetSec + s.end, text: s.text.trim() }));
}

/** Splits a plain transcript into sentences and spreads them evenly over the chunk duration (approximate timestamps). */
function sentencesToSegments(text: string, track: "mic" | "system", offsetSec: number, durationSec: number): Segment[] {
  const who = track === "mic" ? "You" : "Others";
  const parts = text.split(/(?<=[.!?।؟。！？])\s+/u).map((t) => t.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  const total = parts.reduce((n, t) => n + t.length, 0) || 1;
  let cursor = 0;
  return parts.map((t) => {
    const span = (t.length / total) * Math.max(durationSec, 1);
    const seg = { speaker: who, startSec: offsetSec + cursor, endSec: offsetSec + cursor + span, text: t };
    cursor += span;
    return seg;
  });
}

const joinText = (segs: Segment[]) => segs.map((s) => s.text).join(" ");

/** Best-quality single-speaker transcription with native-script steering (gpt-4o-transcribe). */
async function plainTranscribe(file: File, language: string | undefined, prompt: string | undefined): Promise<string> {
  const openai = getOpenAI();
  try {
    const r = await openai.audio.transcriptions.create({ model: PLAIN_MODEL, file, language, prompt, response_format: "json" });
    return r.text.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/prompt/i.test(msg)) throw err;
    const r = await openai.audio.transcriptions.create({ model: PLAIN_MODEL, file, language, response_format: "json" });
    return r.text.trim();
  }
}

/**
 * Transcribes one audio chunk in the given language, keeping the native script.
 *
 * Latin-script languages: the diarize model (timestamps + "Speaker A/B" on the system track).
 * Scripted languages (bn, hi, ar, zh, ja, ko): the diarize model romanizes them, so gpt-4o-transcribe is used with the
 * language hint and a native-script prompt; the text is split into sentences with spread timestamps and the far side
 * is labelled "Others" (no speaker separation yet for these languages).
 * Last resort: whisper-1 with a native-script prompt (it rejects some language codes such as "bn").
 */
export async function transcribeChunk(opts: {
  file: File;
  track: "mic" | "system";
  offsetSec: number;
  durationSec?: number;
  diarize: boolean;
  language?: string | null;
  vocabulary?: string[];
}): Promise<{ segments: Segment[]; language: string | null }> {
  const language = opts.language && opts.language !== "auto" ? opts.language : undefined;
  const info = language ? LANGUAGE_INFO[language] : undefined;
  const scripted = !!info?.script;
  const vocab = opts.vocabulary?.length ? `Names and terms: ${opts.vocabulary.join(", ")}.` : "";
  const prompt = [info?.sample, vocab].filter(Boolean).join(" ") || undefined;
  const duration = opts.durationSec ?? 240;

  let segments: Segment[] = [];

  if (!scripted) {
    try {
      segments = diarizedToSegments(await diarized(opts.file, language), opts.track, opts.diarize, opts.offsetSec);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/model|not found|invalid|response_format|diarized|not supported|language|prompt/i.test(msg)) throw err;
      console.warn("[meetings] diarize model unavailable for this request, falling back:", msg.slice(0, 120));
      segments = [];
    }
  }

  if (segments.length === 0 || (language && isRomanized(joinText(segments), language))) {
    if (segments.length) console.warn(`[meetings] romanized output for ${language}, using ${PLAIN_MODEL}`);
    try {
      const text = await plainTranscribe(opts.file, language, prompt);
      segments = sentencesToSegments(text, opts.track, opts.offsetSec, duration);
      if (language && isRomanized(text, language)) {
        console.warn(`[meetings] still romanized for ${language}, retry with stronger prompt`);
        const strong = [info?.sample, info?.sample, vocab].filter(Boolean).join(" ");
        segments = sentencesToSegments(await plainTranscribe(opts.file, language, strong), opts.track, opts.offsetSec, duration);
      }
    } catch (err) {
      console.warn("[meetings] plain model failed, falling back to whisper:", (err instanceof Error ? err.message : String(err)).slice(0, 120));
      const res = (await getOpenAI().audio.transcriptions.create({
        model: FALLBACK_MODEL,
        file: opts.file,
        // whisper-1 rejects some ISO codes (e.g. "bn"); the native-script prompt steers it instead.
        prompt: prompt,
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      })) as unknown as VerboseResponse;
      segments = verboseToSegments(res, opts.track, opts.offsetSec);
    }
  }

  // Chunk-level label: an all-English chunk inside a Bangla meeting is tagged "en".
  const text = joinText(segments);
  let chunkLang: string | null = null;
  if (text.trim().length >= 12) chunkLang = (await classifyTextLanguage(text)) ?? language ?? null;
  return { segments: segments.map((s) => ({ ...s, language: chunkLang })), language: chunkLang };
}

export function renderTranscript(segments: Segment[], textOf: (s: Segment, i: number) => string = (s) => s.text) {
  const sorted = [...segments].sort((a, b) => a.startSec - b.startSec);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return sorted.map((s, i) => `[${fmt(s.startSec)}] ${s.speaker}: ${textOf(s, i)}`).join("\n");
}

export type Notes = { summary: string; actionItems: string[]; decisions: string[]; questions: string[] };

function notesPrompt(language: string | null) {
  const lang = language
    ? `Write every field in ${languageEnglishName(language)} (${language}), the language the meeting was held in, using its native script (never romanized). Keep proper names and technical terms as spoken.`
    : "Write every field in the dominant language of the transcript, using its native script (never romanized).";
  return `You write meeting notes from a verbatim transcript. "You" is the account owner; other speakers are labelled Speaker A, B, ... or Others.
Return strict JSON with EXACTLY these English keys, never translated: "summary" (3-6 sentence paragraph in plain prose), "actionItems" (array of strings, each "Owner: task — due if mentioned"), "decisions" (array of strings), "questions" (array of open questions or follow-ups).
Be concrete and specific. Do not invent names or facts not in the transcript. If a list has nothing, return an empty array.
${lang} The JSON keys themselves must remain the English identifiers above; only the values are written in that language.`;
}

export function parseNotes(raw: string): Notes {
  const obj = JSON.parse(raw) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  // Some models localize the keys despite instructions; fall back to positional mapping (string, array, array, array).
  const hasKeys = typeof obj.summary === "string" || Array.isArray(obj.actionItems);
  if (!hasKeys) {
    const vals = Object.values(obj);
    const str = vals.find((v) => typeof v === "string") as string | undefined;
    const arrays = vals.filter((v) => Array.isArray(v));
    return { summary: str ?? "", actionItems: arr(arrays[0]), decisions: arr(arrays[1]), questions: arr(arrays[2]) };
  }
  return { summary: typeof obj.summary === "string" ? obj.summary : "", actionItems: arr(obj.actionItems), decisions: arr(obj.decisions), questions: arr(obj.questions) };
}

async function notesForText(text: string, language: string | null): Promise<Notes> {
  const completion = await getOpenAI().chat.completions.create({
    model: CLEAN_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: notesPrompt(language) },
      { role: "user", content: text },
    ],
  });
  return parseNotes(completion.choices[0]?.message?.content ?? "{}");
}

/** Map-reduce over very long transcripts (~60k tokens ≈ 200k chars per window). Notes come back in `language`. */
export async function generateNotes(segments: Segment[], language: string | null): Promise<Notes> {
  const transcript = renderTranscript(segments);
  if (!transcript.trim()) return { summary: "No speech was detected in this meeting.", actionItems: [], decisions: [], questions: [] };
  const WINDOW = 200_000;
  if (transcript.length <= WINDOW) return notesForText(transcript, language);
  const parts: Notes[] = [];
  for (let i = 0; i < transcript.length; i += WINDOW) parts.push(await notesForText(transcript.slice(i, i + WINDOW), language));
  const merged = parts.map((p, i) => `Part ${i + 1} summary: ${p.summary}\nAction items: ${p.actionItems.join("; ")}\nDecisions: ${p.decisions.join("; ")}\nQuestions: ${p.questions.join("; ")}`).join("\n\n");
  return notesForText(`These are partial notes from consecutive parts of one meeting. Combine them into one set of notes.\n\n${merged}`, language);
}

export type TranslationDTO = { targetLang: string; sourceLang: string | null; segments: Record<string, string>; notes: Notes | null; createdAt: number; updatedAt: number; model: string };

export function notesLines(n: Notes, suffix = "") {
  const lines = [`## Summary${suffix}`, "", n.summary, ""];
  if (n.actionItems.length) lines.push(`## Action items${suffix}`, "", ...n.actionItems.map((a) => `- [ ] ${a}`), "");
  if (n.decisions.length) lines.push(`## Decisions${suffix}`, "", ...n.decisions.map((d) => `- ${d}`), "");
  if (n.questions.length) lines.push(`## Open questions${suffix}`, "", ...n.questions.map((q) => `- ${q}`), "");
  return lines;
}

/** Markdown export. With `translationTarget`, the cached translation (if any) is appended after the original. */
export async function meetingToMarkdown(meetingId: string, translationTarget?: string | null) {
  const m = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { notes: true, segments: { orderBy: { startSec: "asc" } }, translations: translationTarget ? { where: { targetLang: translationTarget } } : false },
  });
  if (!m) return null;
  const lang = m.detectedLanguage ?? m.language;
  const { languageLabel } = await import("@/lib/languages");
  const lines = [`# ${m.title}`, "", `${m.startedAt.toLocaleString()} · ${Math.round(m.durationSec / 60)} min · Language: ${languageLabel(lang)}`, ""];
  if (m.notes) lines.push(...notesLines(m.notes));
  lines.push("## Transcript", "", renderTranscript(m.segments));
  const t = translationTarget ? (m as typeof m & { translations?: { targetLang: string; segments: unknown; notes: unknown }[] }).translations?.[0] : undefined;
  if (t) {
    const name = languageEnglishName(t.targetLang);
    const map = (t.segments ?? {}) as Record<string, string>;
    lines.push("", `---`, "", `# Translation (${name})`, "");
    if (t.notes) lines.push(...notesLines(t.notes as Notes, ` (${name})`));
    lines.push(`## Transcript (${name})`, "", renderTranscript(m.segments, (s) => map[(s as Segment & { id?: string }).id ?? ""] ?? s.text));
  }
  return lines.join("\n");
}
