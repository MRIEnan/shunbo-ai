"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Link2, Check } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { FEATURES } from "@/content/site";
import { cn } from "@/lib/cn";

function Card({
  children,
  title,
  body,
  className,
}: {
  children: React.ReactNode;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col rounded-card border border-ink/10 bg-cream-2 overflow-hidden", className)}>
      <div className="relative flex-1 min-h-[16rem] bg-sand-2 p-6 flex items-center justify-center overflow-hidden">
        {children}
      </div>
      <div className="p-6 sm:p-7">
        <h3 className="display text-3xl">{title}</h3>
        <p className="mt-3 text-ink/75">{body}</p>
      </div>
    </div>
  );
}

function Languages() {
  const [i, setI] = useState(0);
  const samples = FEATURES.languages.samples;
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % samples.length), 2600);
    return () => clearInterval(id);
  }, [samples.length]);
  const s = samples[i];
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl bg-cream border border-ink/10 shadow-sm p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink/60">Language:</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={s.lang}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="inline-flex items-center gap-2 font-medium"
            >
              {s.lang} <span className="text-lg leading-none">{s.flag}</span>
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="mt-3 h-px bg-ink/10" />
        <AnimatePresence mode="wait">
          <motion.p
            key={s.lang}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-sm leading-relaxed min-h-[3.5rem]"
          >
            {s.text}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Vocabulary() {
  const names = FEATURES.vocabulary.names;
  return (
    <div className="w-full max-w-sm">
      <div className="flex gap-2 mb-3">
        {names.map((n, i) => (
          <motion.span
            key={n}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.15 }}
            className="rounded-pill bg-cream border border-ink/15 px-3 py-1 text-sm"
          >
            {n}
          </motion.span>
        ))}
      </div>
      <div className="rounded-2xl bg-cream border border-ink/10 shadow-sm p-4 text-sm">
        <div className="font-medium">Add a new word</div>
        <div className="mt-3 rounded-lg border border-ink/15 px-3 py-2 flex items-center justify-between">
          <span>Priya</span>
          <span className="text-ink/60 text-xs">Priya is a client name</span>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-xs text-ink/70">
          <label className="flex items-center gap-2">
            <span className="size-3.5 rounded-sm bg-forest text-cream inline-flex items-center justify-center">
              <Check className="size-2.5" />
            </span>
            Add to vocabulary
          </label>
          <label className="flex items-center gap-2">
            <span className="size-3.5 rounded-sm border border-ink/30" /> Correct a misspelling
          </label>
          <label className="flex items-center gap-2">
            <span className="size-3.5 rounded-sm border border-ink/30" /> Share with team
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <span className="rounded-pill px-3 py-1.5 text-xs border border-ink/15">Cancel</span>
          <span className="rounded-pill px-3 py-1.5 text-xs bg-ink text-cream inline-flex items-center gap-1">
            <Plus className="size-3" /> Add word
          </span>
        </div>
      </div>
    </div>
  );
}

function Snippets() {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setExpanded((v) => !v), 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full max-w-sm text-base sm:text-lg leading-loose">
      If you go to{" "}
      <AnimatePresence mode="wait" initial={false}>
        {expanded ? (
          <motion.span
            key="link"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="inline-flex items-center gap-1.5 rounded-pill bg-cream border border-ink/15 px-3 py-1 text-sm text-forest align-middle"
          >
            <Link2 className="size-3.5" /> linkedin.com/in/priya-rao
          </motion.span>
        ) : (
          <motion.span
            key="trigger"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded bg-lavender px-1.5 italic font-serif align-middle"
          >
            &ldquo;my LinkedIn&rdquo;
          </motion.span>
        )}
      </AnimatePresence>{" "}
      you&rsquo;ll see what I&rsquo;ve been building.
    </div>
  );
}

function Tone() {
  const [i, setI] = useState(0);
  const opts = FEATURES.tone.options;
  return (
    <div className="w-full max-w-sm">
      <div className="inline-flex rounded-pill border border-ink/15 bg-cream p-1 text-sm">
        {opts.map((o, idx) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setI(idx)}
            className={cn("relative rounded-pill px-3 py-1.5 transition-colors", i === idx ? "text-ink" : "text-ink/60")}
          >
            {i === idx && (
              <motion.span
                layoutId="tone"
                className="absolute inset-0 rounded-pill bg-lavender border border-ink/15"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-2xl bg-cream border border-ink/10 shadow-sm p-4 text-sm min-h-[4.5rem]">
        <AnimatePresence mode="wait">
          <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {opts[i].text}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Features() {
  const f = FEATURES;
  return (
    <section id="features" className="py-20 sm:py-28">
      <Container>
        <Reveal className="text-center max-w-3xl mx-auto">
          <p className="eyebrow text-ink/60">{f.eyebrow}</p>
          <h2 className="display mt-5 text-[clamp(2.5rem,6.5vw,4.75rem)]">
            Built around <em className="italic">how you work,</em> not how we think you should.
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-5 md:grid-cols-2">
          <Reveal>
            <Card title={f.languages.title} body={f.languages.body}>
              <Languages />
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <Card title={f.vocabulary.title} body={f.vocabulary.body}>
              <Vocabulary />
            </Card>
          </Reveal>
          <Reveal>
            <Card title={f.snippets.title} body={f.snippets.body}>
              <Snippets />
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <Card title={f.tone.title} body={f.tone.body}>
              <Tone />
            </Card>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
