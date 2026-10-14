import { NextResponse } from "next/server";
import { getOpenAI, TRANSCRIBE_MODEL } from "@/lib/openai";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { currentUser } from "@/lib/session";
import { getEntitlement } from "@/lib/billing";
import { classifyTextLanguage } from "@/lib/meetings";
import { LANGUAGE_INFO, isRomanized } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const limited = await rateLimit(`transcribe:${clientKey(req)}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  // Plan quota for signed-in users (anonymous demo limit is enforced client-side).
  const user = await currentUser();
  if (user) {
    const e = await getEntitlement(user.id);
    if (e.overLimit) {
      return NextResponse.json(
        { error: `You've used your ${e.limit?.toLocaleString()} free words this week. Upgrade to keep dictating.`, code: "quota_exceeded", plan: e.plan.slug, used: e.used, limit: e.limit },
        { status: 402 },
      );
    }
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "No audio provided" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "Audio too large (max 25MB)" }, { status: 413 });
  }

  const language = (form.get("language") as string | null) || undefined;
  const vocabulary = ((form.get("vocabulary") as string | null) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  try {
    const openai = getOpenAI();
    const lang = language && language !== "auto" ? language : undefined;
    const sample = lang ? LANGUAGE_INFO[lang]?.sample : undefined;
    const vocabHint = vocabulary.length ? `Names and terms: ${vocabulary.join(", ")}.` : "";
    const run = (prompt: string | undefined) =>
      openai.audio.transcriptions.create({ model: TRANSCRIBE_MODEL, file: audio, language: lang, prompt, response_format: "json" });
    let text = (await run([sample, vocabHint].filter(Boolean).join(" ") || undefined)).text.trim();
    // Scripted languages (bn, hi, ar, …) sometimes come back romanized: retry once with a stronger native prompt.
    if (lang && isRomanized(text, lang)) {
      console.warn(`[transcribe] romanized output for ${lang}, retrying`);
      text = (await run([sample, sample, vocabHint].filter(Boolean).join(" "))).text.trim();
    }
    const detectedLanguage = text ? await classifyTextLanguage(text) : null;
    return NextResponse.json({ text, language: detectedLanguage });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    console.error("[transcribe]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
