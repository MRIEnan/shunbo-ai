import { ShieldCheck, Lock, FileCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { PRIVACY } from "@/content/site";

export function Privacy() {
  return (
    <section className="py-10 sm:py-16">
      <Container>
        <Reveal>
          <div className="rounded-card border border-ink/10 bg-cream-2 p-8 sm:p-12 grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="display text-4xl sm:text-5xl">{PRIVACY.heading}</h2>
              <p className="mt-4 max-w-xl text-ink/75">{PRIVACY.body}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { icon: ShieldCheck, label: "SOC 2 Type II" },
                  { icon: Lock, label: "HIPAA" },
                  { icon: FileCheck, label: "ISO 27001" },
                ].map((b) => (
                  <span
                    key={b.label}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-ink/15 px-3 py-1.5 text-xs font-medium"
                  >
                    <b.icon className="size-3.5 text-forest" /> {b.label}
                  </span>
                ))}
              </div>
            </div>
            <Button href="/privacy" variant="outline">
              Learn more
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
