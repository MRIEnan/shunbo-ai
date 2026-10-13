import { Container } from "@/components/ui/Container";
import { LEGAL, type LegalSection } from "@/content/legal";

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <main className="py-16 sm:py-24">
      <Container className="max-w-3xl">
        <p className="eyebrow text-ink/60">Legal</p>
        <h1 className="display mt-5 text-5xl sm:text-6xl">{title}</h1>
        <p className="mt-3 text-sm text-ink/60">Last updated: {LEGAL.updated}</p>
        <p className="mt-8 text-ink/80">{intro}</p>
        <div className="mt-10 flex flex-col gap-10">
          {sections.map((s, i) => (
            <section key={s.heading}>
              <h2 className="display text-3xl">
                {i + 1}. {s.heading}
              </h2>
              <div className="mt-4 flex flex-col gap-3 text-ink/80">
                {s.body.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            </section>
          ))}
          <section>
            <h2 className="display text-3xl">{sections.length + 1}. Contact</h2>
            <p className="mt-4 text-ink/80">
              {LEGAL.company} ·{" "}
              <a href={`mailto:${LEGAL.contactEmail}`} className="underline">
                {LEGAL.contactEmail}
              </a>{" "}
              · https://{LEGAL.domain}
            </p>
          </section>
        </div>
      </Container>
    </main>
  );
}
