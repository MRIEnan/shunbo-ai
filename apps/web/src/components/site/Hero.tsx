"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LayoutGrid, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Waveform } from "@/components/ui/Logo";
import { BRAND, HERO } from "@/content/site";

function Strip({
  text,
  className,
  reverse,
  duration = 90,
}: {
  text: string;
  className?: string;
  reverse?: boolean;
  duration?: number;
}) {
  const content = `${text}   ·   ${text}   ·   `;
  return (
    <div className={`overflow-hidden whitespace-nowrap ${className ?? ""}`}>
      <div
        className={`inline-flex ${reverse ? "marquee-reverse" : "marquee"}`}
        style={{ ["--marquee-duration" as string]: `${duration}s` }}
      >
        <span className="px-4">{content}</span>
        <span className="px-4">{content}</span>
      </div>
    </div>
  );
}

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 sm:pt-28">
      <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
        <motion.p
          className="eyebrow text-ink/70"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
        >
          {HERO.eyebrow}
        </motion.p>
        <motion.h1
          className="display mt-6 text-[clamp(3.25rem,10vw,7rem)] leading-[0.95]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.1 }}
        >
          Don&rsquo;t type,
          <br />
          <em className="italic">just speak.</em>
        </motion.h1>
        <motion.p
          className="mx-auto mt-8 max-w-md text-lg text-ink/80"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.25 }}
        >
          {HERO.sub}
        </motion.p>
        <motion.div
          className="mt-8 flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.35 }}
        >
          <Button href="/download" size="lg">
            <LayoutGrid className="size-4" />
            {BRAND.cta}
          </Button>
          <p className="text-xs text-ink/60">
            {BRAND.platforms}{" "}
            <Link href="/app" className="underline underline-offset-4 hover:text-ink">
              Try it in your browser
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Speech to text ribbons */}
      <div className="pointer-events-none relative mt-6 h-64 sm:h-80" aria-hidden>
        <div className="absolute left-1/2 top-1/2 w-[200vw] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg]">
          <Strip
            text={HERO.messy}
            className="font-serif italic text-ink/50 text-lg sm:text-2xl"
            duration={120}
          />
        </div>
        <div className="absolute left-1/2 top-[62%] w-[200vw] -translate-x-1/2 -translate-y-1/2 rotate-[4deg]">
          <div className="bg-ink text-cream py-3 sm:py-4 border-y border-cream/10 shadow-xl">
            <Strip text={HERO.clean} className="text-sm sm:text-lg font-medium" reverse duration={110} />
          </div>
        </div>
        <motion.div
          className="absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-3"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6, ease }}
        >
          <span className="flex items-center justify-center size-14 sm:size-16 rounded-full bg-cream text-ink border border-ink/15 shadow-lg">
            <Waveform bars={7} />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-cream text-ink border border-ink/15 px-3 py-1.5 text-xs font-medium shadow">
            <Check className="size-3.5 text-forest" /> Grammar corrected
          </span>
        </motion.div>
      </div>
    </section>
  );
}
