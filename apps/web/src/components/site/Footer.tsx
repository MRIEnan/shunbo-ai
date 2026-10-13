import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { FOOTER } from "@/content/site";

export function Footer() {
  return (
    <footer className="py-16 sm:py-20">
      <Container>
        <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-ink/60">
              The voice-to-text AI that turns speech into clear, polished writing in every app.
            </p>
          </div>
          {FOOTER.map((col) => (
            <div key={col.title}>
              <div className="text-sm font-semibold">{col.title}</div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <Link href="#" className="text-sm text-ink/65 hover:text-ink transition-colors">
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-ink/10 pt-6 text-xs text-ink/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Shunbo AI. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            {[["Terms", "/terms"], ["Privacy", "/privacy"], ["Data controls", "/privacy#5-retention-and-deletion"]].map(([l, href]) => (
              <Link key={l} href={href} className="hover:text-ink transition-colors">
                {l}
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
