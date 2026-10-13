import { LayoutGrid } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { BRAND, FINAL_CTA } from "@/content/site";

export function FinalCTA() {
  return (
    <section id="get-started" className="px-3 sm:px-6 pb-6">
      <Reveal>
        <div className="rounded-[2.5rem] bg-forest text-cream py-20 sm:py-28 bg-[radial-gradient(80%_60%_at_50%_120%,#0b6b5f_0%,#034f46_70%)]">
          <Container className="text-center max-w-3xl">
            <h2 className="display text-[clamp(2.5rem,7vw,5.5rem)]">{FINAL_CTA.heading}</h2>
            <p className="mx-auto mt-6 max-w-xl text-cream/80 text-lg">{FINAL_CTA.body}</p>
            <div className="mt-10 flex flex-col items-center gap-3">
              <Button href="/download" size="lg">
                <LayoutGrid className="size-4" />
                {BRAND.cta}
              </Button>
              <p className="text-xs text-cream/60">{BRAND.platforms}</p>
            </div>
          </Container>
        </div>
      </Reveal>
    </section>
  );
}
