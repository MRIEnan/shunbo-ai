import { cn } from "@/lib/cn";

export function Waveform({ className, bars = 5 }: { className?: string; bars?: number }) {
  const heights = [8, 16, 22, 14, 18, 10, 20, 12];
  return (
    <span className={cn("inline-flex items-center gap-[3px]", className)} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="block w-[3px] rounded-full bg-current"
          style={{ height: heights[i % heights.length] * 0.8 }}
        />
      ))}
    </span>
  );
}

export function BetaBadge({ light, className }: { light?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center rounded-pill border px-1.5 text-[10px] font-medium uppercase leading-none tracking-wider",
        light ? "border-cream/30 text-cream/80" : "border-ink/15 bg-lavender text-ink/70",
        className,
      )}
    >
      Beta
    </span>
  );
}

export function Logo({ className, light, beta = true }: { className?: string; light?: boolean; beta?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-semibold text-lg tracking-tight",
        light ? "text-cream" : "text-ink",
        className,
      )}
    >
      <Waveform className="text-current" />
      Shunbo
      {beta && <BetaBadge light={light} className="-ml-0.5" />}
    </span>
  );
}
