import type { Metadata } from "next";
import Link from "next/link";
import { Mic, MonitorUp, ListChecks, ShieldCheck, Globe, Monitor } from "lucide-react";
import { AnnouncementBar, Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Shunbo Notetaker | AI meeting notes for any call",
  description: "Record Zoom, Teams, Meet or any call. Get a speaker-labelled transcript, summary, action items and decisions.",
};

const FEATURES = [
  { icon: Mic, title: "Any call, any app", body: "Captures your mic and what you hear. Works with Zoom, Teams, Meet, Slack huddles and phone bridges on your PC." },
  { icon: MonitorUp, title: "Who said what", body: "Your voice is labelled You. Everyone else is separated into speakers automatically, with timestamps." },
  { icon: ListChecks, title: "Notes you can act on", body: "A summary, action items with owners, decisions, and open questions. Copy them or export Markdown." },
  { icon: ShieldCheck, title: "Private by design", body: "Audio is transcribed in chunks during the call and discarded. Only the transcript and notes are stored, and you can delete them anytime." },
];

const SAMPLE = [
  ["00:00", "You", "Let's lock the launch date. Are we still good for the 24th?"],
  ["00:06", "Speaker 1", "Design is done. Legal still has the terms page, they said Thursday."],
  ["00:14", "Speaker 2", "If legal slips, I'd rather move to the following Monday than ship without it."],
  ["00:21", "You", "Agreed. Priya, can you confirm with legal by end of day Thursday?"],
];

export default function NotetakerPage() {
  return (
    <>
      <AnnouncementBar />
      <Nav />
      <main>
        <section className="pt-20 pb-16 sm:pt-28 sm:pb-24">
          <Container>
            <div className="mx-auto max-w-3xl text-center">
              <p className="eyebrow text-ink/60">Shunbo Notetaker</p>
              <h1 className="display mt-6 text-[clamp(3rem,9vw,6.5rem)] leading-[0.95]">
                Be in the meeting, <em className="italic">not the notes.</em>
              </h1>
              <p className="mx-auto mt-8 max-w-xl text-lg text-ink/80">
                Shunbo listens to any call, tells you who said what, and hands you the summary, action items and decisions the moment it ends.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button href="/download" size="lg">
                  <Monitor className="size-4" /> Get the desktop app
                </Button>
                <Button href="/meetings/new" variant="outline" size="lg">
                  <Globe className="size-4" /> Record in your browser
                </Button>
              </div>
              <p className="mt-4 text-xs text-ink/60">Included with every Shunbo plan. 60 free minutes a month.</p>
            </div>

            <Reveal className="mx-auto mt-16 max-w-3xl">
              <div className="rounded-card border border-ink/10 bg-cream-2 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-ink/10 px-5 py-3 text-xs text-ink/60">
                  <span className="size-2 animate-pulse rounded-full bg-coral" /> Recording · Launch sync
                </div>
                <ol className="divide-y divide-ink/5">
                  {SAMPLE.map(([t, who, text]) => (
                    <li key={t} className="grid grid-cols-[3.5rem_6rem_1fr] gap-3 px-5 py-2.5 text-sm">
                      <span className="font-mono text-[11px] text-ink/60 pt-0.5">{t}</span>
                      <span className={who === "You" ? "font-medium" : who === "Speaker 1" ? "font-medium text-forest" : "font-medium text-coral"}>{who}</span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ol>
                <div className="grid gap-4 border-t border-ink/10 bg-sand-2 p-5 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-ink/60">Action items</div>
                    <ul className="mt-2 flex flex-col gap-1"><li>Priya: confirm legal sign-off on the terms page by Thursday EOD</li></ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-ink/60">Decisions</div>
                    <ul className="mt-2 flex flex-col gap-1"><li>Launch on the 24th; if legal slips, move to the following Monday rather than ship without terms</li></ul>
                  </div>
                </div>
              </div>
            </Reveal>
          </Container>
        </section>

        <section className="py-16 sm:py-24">
          <Container>
            <div className="grid gap-5 md:grid-cols-2">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.05}>
                  <div className="h-full rounded-card border border-ink/10 bg-cream-2 p-7">
                    <f.icon className="size-6 text-forest" />
                    <h2 className="display mt-4 text-3xl">{f.title}</h2>
                    <p className="mt-3 text-ink/75">{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-ink/60">
              Recording laws vary. Shunbo shows a visible recording indicator and asks you to confirm participants know they are being recorded.{" "}
              <Link href="/pricing" className="underline">See plans</Link>.
            </p>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
