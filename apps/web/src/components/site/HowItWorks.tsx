"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Plus, Type, Smile, MoreHorizontal, Send, Sparkles, Mail, MessageSquare, FileText } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Waveform } from "@/components/ui/Logo";
import { HOW_STEPS, RAW_TOKENS, CLEAN_MESSAGE } from "@/content/site";
import { cn } from "@/lib/cn";

const KIND_STYLE = {
  filler: "bg-orange/80 text-ink rounded px-0.5",
  correction: "bg-pink/90 text-ink rounded px-0.5",
  repeat: "bg-coral/80 text-cream rounded px-0.5",
};

function RawTranscript({ highlight }: { highlight: boolean }) {
  return (
    <p className="text-[13px] sm:text-sm leading-relaxed text-cream/90">
      {RAW_TOKENS.map((tok, i) =>
        tok.k && highlight ? (
          <motion.span
            key={i}
            className={KIND_STYLE[tok.k]}
            initial={{ backgroundColor: "rgba(0,0,0,0)" }}
            animate={{}}
            transition={{ delay: i * 0.05 }}
          >
            {tok.t}
          </motion.span>
        ) : (
          <span key={i}>{tok.t}</span>
        ),
      )}
    </p>
  );
}

function Composer({ text, sending }: { text?: string; sending?: boolean }) {
  return (
    <div className="rounded-2xl bg-cream text-ink p-3 shadow-lg">
      <div className="min-h-[3.5rem] text-sm leading-relaxed">
        {text ? (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {text}
          </motion.span>
        ) : (
          <span className="text-ink/60">Message...</span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-ink/60">
        <div className="flex items-center gap-3">
          <Plus className="size-4" />
          <Type className="size-4" />
          <Smile className="size-4" />
          <MoreHorizontal className="size-4" />
        </div>
        <Send className={cn("size-4 transition-colors", sending ? "text-forest" : "")} />
      </div>
    </div>
  );
}

function Delivered() {
  const apps = [
    { icon: MessageSquare, label: "Team chat", body: CLEAN_MESSAGE },
    { icon: Mail, label: "Email", body: `Hi Marcus,\n\n${CLEAN_MESSAGE}` },
    { icon: FileText, label: "Notes", body: CLEAN_MESSAGE },
  ];
  return (
    <div className="grid gap-3">
      {apps.map((a, i) => (
        <motion.div
          key={a.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.15, duration: 0.5 }}
          className="rounded-xl bg-cream text-ink p-3 text-xs shadow-md"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink/60 mb-1.5">
            <a.icon className="size-3.5" /> {a.label}
          </div>
          <p className="whitespace-pre-line leading-relaxed line-clamp-3">{a.body}</p>
        </motion.div>
      ))}
    </div>
  );
}

function Visual({ step }: { step: number }) {
  return (
    <div className="relative overflow-hidden rounded-card bg-ink text-cream min-h-[26rem] sm:min-h-[30rem] p-5 sm:p-7 flex flex-col justify-end bg-[radial-gradient(90%_60%_at_20%_0%,#2f3f3a_0%,#1a1a1a_70%)]">
      <AnimatePresence mode="wait">
        {step < 2 ? (
          <motion.div
            key="transcript"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-5"
          >
            <RawTranscript highlight={step >= 0} />
            <Composer text={step === 1 ? CLEAN_MESSAGE : undefined} sending={step === 1} />
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Legend color="bg-orange" label="Filler identified" />
                <Legend color="bg-pink" label="Correction identified" />
                <Legend color="bg-coral" label="Repetition identified" />
              </div>
              <span className="inline-flex items-center gap-2 rounded-pill bg-cream/10 px-3 py-1.5 text-xs">
                <Waveform bars={5} className="text-cream" />
                {step === 1 ? (
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="size-3" /> Cleaning up...
                  </span>
                ) : (
                  "Listening"
                )}
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="delivered"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Delivered />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-cream/70">
      <span className={cn("size-2 rounded-full", color)} /> {label}
    </span>
  );
}

function Step({
  index,
  active,
  onActive,
  title,
  body,
}: {
  index: number;
  active: boolean;
  onActive: (i: number) => void;
  title: string;
  body: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActive(index);
  }, [inView, index, onActive]);
  return (
    <div
      ref={ref}
      className={cn(
        "border-l-2 pl-6 py-2 transition-colors duration-500",
        active ? "border-coral" : "border-ink/10",
      )}
    >
      <h3 className={cn("display text-3xl sm:text-4xl transition-colors", active ? "text-ink" : "text-ink/60")}>
        {title}
      </h3>
      <p className={cn("mt-4 max-w-sm text-base transition-colors", active ? "text-ink/80" : "text-ink/60")}>{body}</p>
    </div>
  );
}

export function HowItWorks() {
  const [step, setStep] = useState(0);
  return (
    <section id="how" className="py-20 sm:py-28">
      <Container>
        <Reveal className="text-center max-w-3xl mx-auto">
          <p className="eyebrow text-ink/60">How it works</p>
          <h2 className="display mt-5 text-[clamp(2.5rem,6.5vw,4.75rem)]">
            Speak at the speed you think, <em className="italic">in every app, on every device.</em>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="lg:sticky lg:top-28 self-start">
            <Visual step={step} />
          </div>
          <div className="flex flex-col gap-16 sm:gap-24 lg:py-24">
            {HOW_STEPS.map((s, i) => (
              <Step key={s.title} index={i} active={step === i} onActive={setStep} {...s} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
