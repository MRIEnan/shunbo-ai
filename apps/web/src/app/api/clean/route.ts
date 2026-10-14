import { NextResponse } from "next/server";
import { getOpenAI, CLEAN_MODEL } from "@/lib/openai";
import { cleanupSystemPrompt, TONES, type Tone, type SnippetHint } from "@/lib/prompts";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { maintenanceGuard } from "@/lib/maintenance";
import { currentUser } from "@/lib/session";
import { anonymousAllow, ANON_MAX_TEXT_CHARS } from "@/lib/metering";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_CHARS = 12_000;

export async function POST(req: Request) {
  const limited = await rateLimit(`clean:${clientKey(req)}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  // AI paused from the admin dashboard: refuse before any OpenAI call.
  const paused = await maintenanceGuard();
  if (paused) return paused;

  let body: { raw?: unknown; tone?: unknown; vocabulary?: unknown; snippets?: unknown; instructions?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const raw = typeof body.raw === "string" ? body.raw.trim() : "";
  if (!raw) return NextResponse.json({ error: "Nothing to clean" }, { status: 400 });
  const user = await currentUser();
  if (raw.length > (user ? MAX_CHARS : ANON_MAX_TEXT_CHARS)) {
    return NextResponse.json({ error: user ? "Transcript too long" : "Demo transcripts are limited to 2,000 characters. Sign in for more.", code: "too_large" }, { status: 413 });
  }
  if (!user) {
    const a = await anonymousAllow("clean", req);
    if (!a.ok) return NextResponse.json({ error: `You've used the ${a.limit} free demo dictations for today. Sign in to keep going.`, code: "sign_in_required" }, { status: 401 });
  }
  const tone: Tone = TONES.includes(body.tone as Tone) ? (body.tone as Tone) : "casual";
  const vocabulary = Array.isArray(body.vocabulary)
    ? body.vocabulary.filter((v): v is string => typeof v === "string").slice(0, 100)
    : [];
  const snippets: SnippetHint[] = Array.isArray(body.snippets)
    ? body.snippets
        .filter((s): s is SnippetHint => !!s && typeof s.trigger === "string" && typeof s.expansion === "string")
        .slice(0, 50)
    : [];
  const instructions = typeof body.instructions === "string" ? body.instructions.slice(0, 500) : "";

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: CLEAN_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: cleanupSystemPrompt(tone, vocabulary, snippets, instructions) },
        { role: "user", content: raw },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ text: text || raw });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cleanup failed";
    console.error("[clean]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
