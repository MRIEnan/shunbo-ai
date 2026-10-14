import { getOpenAI, CLEAN_MODEL } from "@/lib/openai";
import { languageEnglishName } from "@/lib/languages";
import { parseNotes, type Notes } from "@/lib/meetings";

export const TRANSLATE_MODEL = CLEAN_MODEL;

type Item = { id: string; text: string; language?: string | null };

const BATCH_CHARS = 6_000;
const CONCURRENCY = 3;

function translatePrompt(source: string | null, target: string) {
  const from = source ? `from ${languageEnglishName(source)} ` : "";
  return `You translate meeting transcript lines ${from}to ${languageEnglishName(target)} (${target}).
Input is JSON {"items":[{"id":"...","text":"..."}]}. Return JSON {"items":[{"id":"...","text":"..."}]} with exactly the same ids and count.
Translate each text faithfully and naturally, keeping the speaker's meaning, names, numbers, dates and technical terms. Do not merge, drop, summarize, or add items. Text already in the target language is returned unchanged.`;
}

async function translateBatch(items: Item[], source: string | null, target: string): Promise<Record<string, string>> {
  const completion = await getOpenAI().chat.completions.create({
    model: TRANSLATE_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: translatePrompt(source, target) },
      { role: "user", content: JSON.stringify({ items: items.map(({ id, text }) => ({ id, text })) }) },
    ],
  });
  const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { items?: { id?: string; text?: string }[] };
  const out: Record<string, string> = {};
  for (const it of parsed.items ?? []) if (typeof it.id === "string" && typeof it.text === "string") out[it.id] = it.text;
  return out;
}

/** Translates segments into `target`; ones already in the target language are copied verbatim. */
export async function translateSegments(items: Item[], source: string | null, target: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const todo: Item[] = [];
  for (const it of items) {
    if (it.language === target || !it.text.trim()) result[it.id] = it.text;
    else todo.push(it);
  }
  // Batch by size
  const batches: Item[][] = [];
  let cur: Item[] = [];
  let size = 0;
  for (const it of todo) {
    if (cur.length && size + it.text.length > BATCH_CHARS) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(it);
    size += it.text.length;
  }
  if (cur.length) batches.push(cur);

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const outs = await Promise.all(batches.slice(i, i + CONCURRENCY).map((b) => translateBatch(b, source, target)));
    for (const o of outs) Object.assign(result, o);
  }
  // One retry for anything the model dropped.
  const missing = todo.filter((it) => !(it.id in result));
  if (missing.length) {
    for (let i = 0; i < missing.length; i += 40) Object.assign(result, await translateBatch(missing.slice(i, i + 40), source, target));
    for (const it of missing) if (!(it.id in result)) result[it.id] = it.text; // last resort: keep original
  }
  return result;
}

export async function translateNotes(notes: Notes, source: string | null, target: string): Promise<Notes> {
  // Nothing to translate: never let the model invent notes from an empty object.
  if (!notes.summary.trim() && !notes.actionItems.length && !notes.decisions.length && !notes.questions.length) return notes;
  const from = source ? `from ${languageEnglishName(source)} ` : "";
  const completion = await getOpenAI().chat.completions.create({
    model: TRANSLATE_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `Translate these meeting notes ${from}to ${languageEnglishName(target)} (${target}). Return JSON with EXACTLY the same English keys: "summary" (string), "actionItems", "decisions", "questions" (arrays of strings, same lengths, same order). Translate only the values; keep names, numbers and technical terms. Do not add, drop or summarize.` },
      { role: "user", content: JSON.stringify(notes) },
    ],
  });
  return parseNotes(completion.choices[0]?.message?.content ?? "{}");
}
