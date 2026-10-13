import { prisma } from "@/lib/prisma";
import { getOpenAI, CLEAN_MODEL } from "@/lib/openai";

export const DIARIZE_MODEL = "gpt-4o-transcribe-diarize";
export const FALLBACK_MODEL = "whisper-1";

export type Segment = { speaker: string; startSec: number; endSec: number; text: string };

type DiarizedResponse = { segments?: { speaker?: string; start?: number; end?: number; text?: string }[]; text?: string };
type VerboseResponse = { segments?: { start: number; end: number; text: string }[]; text?: string };

/**
 * Transcribes one audio chunk. The mic track is always a single speaker ("You").
 * The system track is diarized into "Speaker 1..n" when requested; otherwise "Others".
 * Timestamps are shifted by `offsetSec` so segments line up on the meeting timeline.
 */
export async function transcribeChunk(opts: {
  file: File;
  track: "mic" | "system";
  offsetSec: number;
  diarize: boolean;
  language?: string;
  vocabulary?: string[];
}): Promise<Segment[]> {
  const openai = getOpenAI();
  const hint = opts.vocabulary?.length ? `Names and terms: ${opts.vocabulary.join(", ")}.` : undefined;
  const language = opts.language && opts.language !== "auto" ? opts.language : undefined;
  const label = (speaker: string | undefined, i: number) =>
    opts.track === "mic" ? "You" : opts.diarize ? `Speaker ${(speaker ?? String(i + 1)).replace(/^speaker[_\s]?/i, "").replace(/^(\d+)$/, "$1")}` : "Others";

  // Preferred: diarizing model with timestamps.
  try {
    const res = (await openai.audio.transcriptions.create({
      model: DIARIZE_MODEL,
      file: opts.file,
      language,
      prompt: hint,
      response_format: "diarized_json",
      chunking_strategy: "auto",
    })) as unknown as DiarizedResponse;
    if (res.segments?.length) {
      return res.segments
        .filter((s) => s.text?.trim())
        .map((s, i) => ({
          speaker: label(s.speaker, i),
          startSec: opts.offsetSec + (s.start ?? 0),
          endSec: opts.offsetSec + (s.end ?? s.start ?? 0),
          text: s.text!.trim(),
        }));
    }
    if (res.text?.trim()) {
      return [{ speaker: label(undefined, 0), startSec: opts.offsetSec, endSec: opts.offsetSec, text: res.text.trim() }];
    }
    return [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Model missing or format unsupported → fall back to whisper-1 with segment timestamps.
    if (!/model|not found|invalid|response_format|diarized/i.test(msg)) throw err;
    console.warn("[meetings] diarize model unavailable, falling back:", msg.slice(0, 120));
  }

  const res = (await openai.audio.transcriptions.create({
    model: FALLBACK_MODEL,
    file: opts.file,
    language,
    prompt: hint,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  })) as unknown as VerboseResponse;
  const who = opts.track === "mic" ? "You" : "Others";
  return (res.segments ?? [])
    .filter((s) => s.text.trim())
    .map((s) => ({ speaker: who, startSec: opts.offsetSec + s.start, endSec: opts.offsetSec + s.end, text: s.text.trim() }));
}

export function renderTranscript(segments: Segment[]) {
  const sorted = [...segments].sort((a, b) => a.startSec - b.startSec);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return sorted.map((s) => `[${fmt(s.startSec)}] ${s.speaker}: ${s.text}`).join("\n");
}

export type Notes = { summary: string; actionItems: string[]; decisions: string[]; questions: string[] };

const NOTES_PROMPT = `You write meeting notes from a transcript. "You" is the account owner; other speakers are labelled Speaker 1, 2, ... or Others.
Return strict JSON with keys: summary (3-6 sentence paragraph in plain prose), actionItems (array of strings, each "Owner: task — due if mentioned"), decisions (array of strings), questions (array of open questions or follow-ups).
Be concrete and specific. Do not invent names or facts not in the transcript. If a list has nothing, return an empty array.`;

async function notesForText(text: string): Promise<Notes> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: CLEAN_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: NOTES_PROMPT },
      { role: "user", content: text },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<Notes>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return { summary: typeof parsed.summary === "string" ? parsed.summary : "", actionItems: arr(parsed.actionItems), decisions: arr(parsed.decisions), questions: arr(parsed.questions) };
}

/** Map-reduce over very long transcripts (~60k tokens ≈ 240k chars per window). */
export async function generateNotes(segments: Segment[]): Promise<Notes> {
  const transcript = renderTranscript(segments);
  if (!transcript.trim()) return { summary: "No speech was detected in this meeting.", actionItems: [], decisions: [], questions: [] };
  const WINDOW = 200_000;
  if (transcript.length <= WINDOW) return notesForText(transcript);
  const parts: Notes[] = [];
  for (let i = 0; i < transcript.length; i += WINDOW) parts.push(await notesForText(transcript.slice(i, i + WINDOW)));
  const merged = parts.map((p, i) => `Part ${i + 1} summary: ${p.summary}\nAction items: ${p.actionItems.join("; ")}\nDecisions: ${p.decisions.join("; ")}\nQuestions: ${p.questions.join("; ")}`).join("\n\n");
  return notesForText(`These are partial notes from consecutive parts of one meeting. Combine them into one set of notes.\n\n${merged}`);
}

export async function meetingToMarkdown(meetingId: string) {
  const m = await prisma.meeting.findUnique({ where: { id: meetingId }, include: { notes: true, segments: { orderBy: { startSec: "asc" } } } });
  if (!m) return null;
  const lines = [`# ${m.title}`, "", `${m.startedAt.toLocaleString()} · ${Math.round(m.durationSec / 60)} min`, ""];
  if (m.notes) {
    lines.push("## Summary", "", m.notes.summary, "");
    if (m.notes.actionItems.length) lines.push("## Action items", "", ...m.notes.actionItems.map((a) => `- [ ] ${a}`), "");
    if (m.notes.decisions.length) lines.push("## Decisions", "", ...m.notes.decisions.map((d) => `- ${d}`), "");
    if (m.notes.questions.length) lines.push("## Open questions", "", ...m.notes.questions.map((q) => `- ${q}`), "");
  }
  lines.push("## Transcript", "", renderTranscript(m.segments));
  return lines.join("\n");
}
