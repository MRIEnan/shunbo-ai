import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { CASE_STUDY, QUOTES } from "@/content/site";
import { cn } from "@/lib/cn";

const ROTATIONS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "-rotate-1"];

export function Testimonials() {
  return (
    <section id="customers" className="px-3 sm:px-6 py-6">
      <div className="rounded-[2.5rem] bg-ink text-cream py-20 sm:py-28 overflow-hidden">
        <Container>
          <Reveal className="text-center max-w-2xl mx-auto">
            <p className="eyebrow text-cream/60">Early access, real results</p>
            <h2 className="display mt-5 text-[clamp(2.75rem,7vw,5.5rem)]">
              From the first <em className="italic">people to use it.</em>
            </h2>
          </Reveal>

          <Reveal className="mt-16">
            <div className="rounded-card bg-lavender text-ink p-6 sm:p-10 grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <div className="font-sans text-2xl font-semibold uppercase tracking-tight">{CASE_STUDY.name}</div>
                <div className="text-sm text-ink/60">{CASE_STUDY.role}</div>
                <p className="display mt-6 text-3xl sm:text-4xl leading-tight">&ldquo;{CASE_STUDY.quote}&rdquo;</p>
                <a href="#case-study" className="mt-8 inline-flex items-center gap-2 text-sm font-medium hover:underline">
                  Read case study <ArrowRight className="size-4" />
                </a>
              </div>
              <div className="rounded-2xl overflow-hidden bg-[linear-gradient(135deg,#2f2f2f,#1a1a1a)] text-cream p-6 min-h-[18rem] flex flex-col justify-end">
                <div className="grid grid-cols-2 gap-6">
                  {CASE_STUDY.stats.map((s) => (
                    <div key={s.label}>
                      <div className="display text-5xl">{s.value}</div>
                      <div className="mt-1 text-xs text-cream/70 max-w-[8rem]">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {QUOTES.map((q, i) => (
              <Reveal key={q.name} delay={i * 0.06}>
                <figure
                  className={cn(
                    "h-full rounded-card bg-cream text-ink p-7 transition-transform hover:rotate-0 hover:scale-[1.02]",
                    ROTATIONS[i % ROTATIONS.length],
                  )}
                >
                  <blockquote className="display text-2xl leading-snug">&ldquo;{q.quote}&rdquo;</blockquote>
                  <figcaption className="mt-6 text-sm">
                    <div className="font-semibold">{q.name}</div>
                    <div className="text-ink/60">{q.role}</div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </Container>
      </div>
    </section>
  );
}
