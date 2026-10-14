"use client";

import { Languages } from "lucide-react";
import { LANGUAGES, languageLabel, LANGUAGE_INFO } from "@/lib/languages";
import { cn } from "@/lib/cn";

type Props = {
  code: string | null | undefined;
  /** Other languages heard in the meeting; shown as "+English" chips. */
  extra?: string[];
  /** When given, the badge becomes a select so the user can correct the detected language. */
  onChange?: (code: string) => void;
  className?: string;
  size?: "sm" | "md";
};

export function LanguageBadge({ code, extra = [], onChange, className, size = "sm" }: Props) {
  const others = extra.filter((c) => c && c !== code);
  const base = cn("inline-flex items-center gap-1 rounded-pill font-medium", size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs", code ? "bg-ink/5 text-ink" : "bg-ink/5 text-ink/60", className);

  if (onChange) {
    return (
      <span className={cn(base, "relative pr-6")}>
        <Languages className="size-3" />
        <span lang={code ?? undefined}>{languageLabel(code)}</span>
        <select
          aria-label="Meeting language"
          value={code ?? ""}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="" disabled>
            Choose language
          </option>
          {LANGUAGES.filter((l) => l.code !== "auto").map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px]">▾</span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={base} title={code ? LANGUAGE_INFO[code]?.english : "Language not detected"}>
        <Languages className="size-3" />
        <span lang={code ?? undefined}>{languageLabel(code)}</span>
      </span>
      {others.map((c) => (
        <span key={c} lang={c} className="rounded-pill border border-ink/15 px-1.5 py-0.5 text-[10px] text-ink/70" title={`Also spoken: ${languageLabel(c)}`}>
          +{LANGUAGE_INFO[c]?.native ?? c}
        </span>
      ))}
    </span>
  );
}
