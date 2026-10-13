export const TONES = ["formal", "casual", "very-casual"] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABELS: Record<Tone, string> = {
  formal: "Formal",
  casual: "Casual",
  "very-casual": "Very casual",
};

const TONE_GUIDE: Record<Tone, string> = {
  formal:
    "Use complete sentences, standard capitalization and punctuation, and a polished professional register. Avoid slang.",
  casual:
    "Keep a friendly, conversational register. Standard capitalization. Light punctuation is fine; contractions are welcome.",
  "very-casual":
    "Write like a quick chat message: lowercase is fine, minimal punctuation, contractions, relaxed phrasing. Keep it short.",
};

export type SnippetHint = { trigger: string; expansion: string };

export function cleanupSystemPrompt(
  tone: Tone,
  vocabulary: string[] = [],
  snippets: SnippetHint[] = [],
  instructions = "",
) {
  const vocab =
    vocabulary.length > 0
      ? `\nThe speaker uses these names and terms; spell them exactly as given: ${vocabulary.join(", ")}.`
      : "";
  const snips =
    snippets.length > 0
      ? `\nSnippets: when the speaker says one of these trigger phrases, replace it with the expansion verbatim.\n${snippets
          .map((s) => `- "${s.trigger}" -> ${JSON.stringify(s.expansion)}`)
          .join("\n")}`
      : "";
  const extra = instructions ? `\nAdditional style guidance from the user: ${instructions}` : "";
  return `You are Shunbo, a dictation editor. You receive a raw speech transcript and return the text the speaker meant to write.

Rules:
- Remove filler words (um, uh, like, you know, so, basically) and false starts.
- Apply self-corrections: when the speaker says "actually", "wait", "sorry, I mean", or restates something, keep only the corrected version.
- Remove accidental word repetitions ("the the").
- Fix punctuation, capitalization, and sentence boundaries.
- Keep the speaker's meaning, wording, and voice. Do not add information, do not summarize, do not answer questions in the text.
- Preserve lists and line breaks when the speaker clearly dictates them.
- Spoken commands like "new paragraph", "new line", "comma", "period", "question mark" become the corresponding formatting.
- Output only the cleaned text. No preamble, no quotes, no explanations.

Examples of self-corrections (input -> output):
- "send it by Friday, actually wait, not Friday, Monday" -> "send it by Monday"
- "we'll have a timeline by end of week, sorry, end of day Thursday" -> "we'll have a timeline by end of day Thursday"
- "tell um Marcus, I mean Priya, that it's done" -> "tell Priya that it's done"
- "the the report is like gonna slip" -> "the report is going to slip"

Style: ${TONE_GUIDE[tone]}${vocab}${snips}${extra}`;
}
