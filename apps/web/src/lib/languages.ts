// Shared language metadata. Importable from server and client code (no "use client").

export type LanguageInfo = {
  native: string;
  english: string;
  /** Regex matching this language's native script letters (absent for Latin-script languages). */
  script?: RegExp;
  /** A native-script sentence used as a transcription prompt nudge so output stays in the native script. */
  sample?: string;
  /** Name whisper-1 returns in verbose_json `language`. */
  whisperName: string;
};

export const LANGUAGE_INFO: Record<string, LanguageInfo> = {
  en: { native: "English", english: "English", whisperName: "english" },
  bn: { native: "বাংলা", english: "Bengali", script: /[ঀ-৿]/, sample: "এই কথোপকথনটি বাংলায় হচ্ছে।", whisperName: "bengali" },
  hi: { native: "हिन्दी", english: "Hindi", script: /[ऀ-ॿ]/, sample: "यह बातचीत हिन्दी में हो रही है।", whisperName: "hindi" },
  es: { native: "Español", english: "Spanish", whisperName: "spanish" },
  fr: { native: "Français", english: "French", whisperName: "french" },
  de: { native: "Deutsch", english: "German", whisperName: "german" },
  pt: { native: "Português", english: "Portuguese", whisperName: "portuguese" },
  ar: { native: "العربية", english: "Arabic", script: /[؀-ۿ]/, sample: "هذه المحادثة باللغة العربية.", whisperName: "arabic" },
  zh: { native: "中文", english: "Chinese", script: /[一-鿿]/, sample: "这段对话是用中文进行的。", whisperName: "chinese" },
  ja: { native: "日本語", english: "Japanese", script: /[぀-ヿ一-鿿]/, sample: "この会話は日本語で行われています。", whisperName: "japanese" },
  ko: { native: "한국어", english: "Korean", script: /[가-힯]/, sample: "이 대화는 한국어로 진행됩니다.", whisperName: "korean" },
};

/** Options for language selects. "auto" = detect. */
export const LANGUAGES: { code: string; label: string }[] = [
  { code: "auto", label: "Auto-detect" },
  ...Object.entries(LANGUAGE_INFO).map(([code, info]) => ({ code, label: info.native === info.english ? info.english : `${info.english} (${info.native})` })),
];

export const isSupportedLanguage = (code: unknown): code is string => typeof code === "string" && code in LANGUAGE_INFO;

/** "বাংলা · Bengali", "English", or "Unknown". */
export function languageLabel(code: string | null | undefined): string {
  if (!code) return "Unknown";
  const info = LANGUAGE_INFO[code];
  if (!info) return code.toUpperCase();
  return info.native === info.english ? info.english : `${info.native} · ${info.english}`;
}

export const languageEnglishName = (code: string) => LANGUAGE_INFO[code]?.english ?? code;

/** Fraction of letters in `text` that belong to the language's native script (0 for Latin-script languages). */
export function scriptRatio(text: string, code: string): number {
  const info = LANGUAGE_INFO[code];
  if (!info?.script) return 0;
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 0;
  const native = letters.filter((ch) => info.script!.test(ch)).length;
  return native / letters.length;
}

/** True when a scripted language came back mostly in Latin letters (e.g. romanized Bangla). */
export function isRomanized(text: string, code: string): boolean {
  const info = LANGUAGE_INFO[code];
  if (!info?.script) return false;
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 8) return false;
  const latin = letters.filter((ch) => /[A-Za-z]/.test(ch)).length / letters.length;
  return scriptRatio(text, code) < 0.5 && latin > 0.5;
}

/** Best-effort language guess from script alone; null when the text is Latin-script or empty. */
export function detectByScript(text: string): string | null {
  let best: { code: string; ratio: number } | null = null;
  for (const code of Object.keys(LANGUAGE_INFO)) {
    if (!LANGUAGE_INFO[code].script) continue;
    const ratio = scriptRatio(text, code);
    if (ratio > 0.6 && (!best || ratio > best.ratio)) best = { code, ratio };
  }
  // Japanese shares Han characters with Chinese: prefer ja when kana are present.
  if (best?.code === "zh" && /[぀-ヿ]/.test(text)) return "ja";
  return best?.code ?? null;
}

export function whisperNameToCode(name: string | undefined | null): string | null {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  for (const [code, info] of Object.entries(LANGUAGE_INFO)) if (info.whisperName === n || code === n) return code;
  return null;
}
