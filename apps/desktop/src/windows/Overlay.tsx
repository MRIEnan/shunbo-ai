import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Check, AlertCircle, Loader2 } from "lucide-react";

export type OverlayState = {
  state: "idle" | "listening" | "transcribing" | "polishing" | "done" | "error" | "meeting";
  level?: number;
  elapsed?: number;
  message?: string;
};

function Bars({ level }: { level: number }) {
  const seeds = useMemo(() => Array.from({ length: 18 }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + 0.5))), []);
  return (
    <div className="flex h-7 items-center gap-[3px]">
      {seeds.map((s, i) => (
        <span key={i} className="w-[3px] rounded-full bg-cream transition-[height] duration-75" style={{ height: Math.max(4, Math.min(28, 5 + level * 40 * s)) }} />
      ))}
    </div>
  );
}

export function OverlayWindow() {
  const [s, setS] = useState<OverlayState>({ state: "idle" });

  useEffect(() => {
    const un = listen<OverlayState>("overlay", (e) => setS(e.payload));
    return () => {
      un.then((f) => f());
    };
  }, []);

  const visible = s.state !== "idle";
  const tone =
    s.state === "error" || s.state === "meeting" ? "bg-coral text-cream" : s.state === "done" ? "bg-forest text-cream" : "bg-ink/95 text-cream";
  const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

  return (
    <div className="flex h-full items-end justify-center pb-3">
      <div
        className={`flex items-center gap-3 rounded-pill px-4 py-2.5 shadow-2xl backdrop-blur transition-all duration-200 ${tone} ${
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        {s.state === "meeting" && (
          <>
            <span className="size-2.5 animate-pulse rounded-full bg-cream" />
            <span className="text-sm">Recording meeting</span>
            <span className="text-xs tabular-nums text-cream/70">{fmt(s.elapsed ?? 0)}</span>
          </>
        )}
        {s.state === "listening" && (
          <>
            <Bars level={s.level ?? 0} />
            <span className="text-xs tabular-nums text-cream/70">{(s.elapsed ?? 0).toFixed(0)}s</span>
          </>
        )}
        {(s.state === "transcribing" || s.state === "polishing") && (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">{s.state === "transcribing" ? "Transcribing…" : "Polishing…"}</span>
          </>
        )}
        {s.state === "done" && (
          <>
            <Check className="size-4" />
            <span className="max-w-[18rem] truncate text-sm">{s.message ?? "Pasted"}</span>
          </>
        )}
        {s.state === "error" && (
          <>
            <AlertCircle className="size-4" />
            <span className="max-w-[18rem] truncate text-sm">{s.message ?? "Something went wrong"}</span>
          </>
        )}
      </div>
    </div>
  );
}
