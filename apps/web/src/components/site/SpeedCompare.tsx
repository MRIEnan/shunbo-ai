"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { Keyboard } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Waveform } from "@/components/ui/Logo";
import { SPEED } from "@/content/site";

function useTypewriter(text: string, wpm: number, active: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    const cps = (wpm * 5.5) / 60; // ~5.5 chars per word
    const interval = 1000 / cps;
    const id = setInterval(() => {
      setCount((c) => (c >= text.length ? 0 : c + 1));
    }, interval);
    return () => clearInterval(id);
  }, [text, wpm, active]);
  return text.slice(0, count);
}

function Card({
  label,
  wpm,
  icon,
  active,
  dark,
}: {
  label: string;
  wpm: number;
  icon: React.ReactNode;
  active: boolean;
  dark?: boolean;
}) {
  const typed = useTypewriter(SPEED.sample, wpm, active);
  return (
    <div
      className={`relative overflow-hidden rounded-card p-6 sm:p-8 min-h-[22rem] flex flex-col ${
        dark
          ? "bg-forest text-cream bg-[radial-gradient(120%_80%_at_80%_100%,#0b6b5f_0%,#034f46_60%)]"
          : "bg-sand-2 text-ink border border-ink/10"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium opacity-80">
        {icon}
        {label}
      </div>
      <div className="display mt-3 text-4xl sm:text-5xl">
        {wpm} <span className="text-2xl sm:text-3xl">wpm</span>
      </div>
      <div className={`mt-6 flex-1 rounded-2xl p-4 text-sm leading-relaxed ${dark ? "bg-cream/10" : "bg-cream"}`}>
        <span className="caret">{typed}</span>
      </div>
    </div>
  );
}

export function SpeedCompare() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <Reveal className="text-center max-w-2xl mx-auto">
          <h2 className="display text-[clamp(2.5rem,7vw,5rem)]">
            4x faster <em className="italic">than typing</em>
          </h2>
          <p className="mt-6 text-lg text-ink/80">{SPEED.sub}</p>
        </Reveal>
        <div ref={ref} className="mt-14 grid gap-5 md:grid-cols-2">
          <Reveal delay={0.05}>
            <Card label="Keyboard" wpm={45} icon={<Keyboard className="size-4" />} active={inView} />
          </Reveal>
          <Reveal delay={0.15}>
            <Card label="Shunbo" wpm={220} icon={<Waveform bars={4} className="text-current" />} active={inView} dark />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
