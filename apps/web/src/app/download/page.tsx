import type { Metadata } from "next";
import Link from "next/link";
import { Download, Keyboard, Monitor, ShieldCheck } from "lucide-react";
import { AnnouncementBar, Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Download Shunbo for Windows | Shunbo AI",
  description: "Hold a key, speak, release. Shunbo types polished text into any app on your PC.",
};

const STEPS = [
  { icon: Download, title: "Install", body: "Run the installer. No admin rights needed; Shunbo installs for the current user and lives in your system tray." },
  { icon: Monitor, title: "Sign in", body: "Click \"Sign in with browser\". We open your Shunbo account page, you approve, and the app connects automatically." },
  { icon: Keyboard, title: "Hold Ctrl + Shift + Space", body: "Put your cursor anywhere, hold the shortcut, talk, and let go. The polished text is pasted where you were typing." },
];

export default function DownloadPage() {
  const url = process.env.NEXT_PUBLIC_DOWNLOAD_URL;
  return (
    <>
      <AnnouncementBar />
      <Nav />
      <main className="py-16 sm:py-24">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-ink/60">Download</p>
            <h1 className="display mt-5 text-[clamp(2.75rem,7vw,5rem)]">
              Shunbo for <em className="italic">Windows.</em>
            </h1>
            <p className="mt-6 text-lg text-ink/75">
              Dictate into Slack, Gmail, Notion, VS Code, or anything else with a text box. Works with your style presets, vocabulary, and snippets.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              {url ? (
                <a
                  href={url}
                  className="inline-flex h-13 items-center gap-2 rounded-pill border border-ink/80 bg-lavender px-7 text-base font-medium shadow-[0_2px_0_0_rgba(26,26,26,0.8)] transition-all hover:-translate-y-0.5"
                >
                  <Download className="size-5" /> Download for Windows
                </a>
              ) : (
                <span className="inline-flex h-13 items-center gap-2 rounded-pill border border-ink/20 px-7 text-base text-ink/60">
                  <Download className="size-5" /> Windows build coming soon
                </span>
              )}
              <p className="text-xs text-ink/60">
                Windows 10 or 11, 64-bit. Mac coming soon. Or{" "}
                <Link href="/app" className="underline underline-offset-4">
                  use Shunbo in your browser
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-card border border-ink/10 bg-cream-2 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-lavender text-sm font-semibold">{i + 1}</span>
                  <s.icon className="size-5 text-forest" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">{s.title}</h2>
                <p className="mt-2 text-sm text-ink/70">{s.body}</p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-12 flex max-w-xl items-start gap-2 text-center text-xs text-ink/60 sm:text-left">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-forest" />
            Audio is sent to Shunbo only while you hold the shortcut and is not stored. You can disconnect a computer at any time from the app.
          </p>
        </Container>
      </main>
      <Footer />
    </>
  );
}
