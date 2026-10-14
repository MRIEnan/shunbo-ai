import { NextResponse } from "next/server";
import { getOpenAI, TRANSCRIBE_MODEL } from "@/lib/openai";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { currentUser } from "@/lib/session";
import { getEntitlement } from "@/lib/billing";
import { classifyTextLanguage } from "@/lib/meetings";
import { LANGUAGE_INFO, isRomanized } from "@/lib/languages";
import { countWords } from "@/lib/tone";
import { anonymousAllow, meterDictation, ANON_MAX_AUDIO_BYTES, MAX_DICTATION_BYTES, MIN_WORDS_TO_START } from "@/lib/metering";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const limited = await rateLimit(`transcribe:${clientKey(req)}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  // Signed-in: plan allowance (with a small margin so one dictation can overshoot by at most one clip).
  // Signed-out demo: a server-side allowance per client, so skipping the client counter buys nothing.
  const user = await currentUser();
  if (user) {
    const e = await getEntitlement(user.id);
    if (e.overLimit || (e.remaining !== null && e.remaining < MIN_WORDS_TO_START)) {
      return NextResponse.json(
        { error: `You've used your ${e.limit?.toLocaleString()} words this week on the ${e.plan.name} plan. Upgrade to keep dictating.`, code: "quota_exceeded", plan: e.plan.slug, used: e.used, limit: e.limit },
        { status: 402 },
      );
    }
  } else {
    const a = await anonymousAllow("transcribe", req);
    if (!a.ok) {
      return NextResponse.json({ error: `You've used the ${a.limit} free demo dictations for today. Sign in to keep going.`, code: "sign_in_required" }, { status: 401 });
    }
  }

  const maxBytes = user ? MAX_DICTATION_BYTES : ANON_MAX_AUDIO_BYTES;
  const tooLarge = NextResponse.json({ error: user ? "Audio too large: dictations are limited to 10 minutes." : "Demo clips are limited to about a minute. Sign in for longer dictations.", code: "too_large" }, { status: 413 });
  // Declared size first: oversize bodies are refused before the multipart parser (which fails with a generic error).
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes + 64 * 1024) return tooLarge;
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
  if (audio.size > maxBytes) return tooLarge;

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
    const words = countWords(text);
    const [detectedLanguage] = await Promise.all([text ? classifyTextLanguage(text) : Promise.resolve(null), user ? meterDictation(user.id, words) : Promise.resolve()]);
    return NextResponse.json({ text, language: detectedLanguage, words });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    console.error("[transcribe]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
