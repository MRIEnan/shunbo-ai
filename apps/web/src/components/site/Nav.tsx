"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LayoutGrid } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/content/site";
import { cn } from "@/lib/cn";

const LINKS = [
  { label: "Try in browser", href: "/app" },
  { label: "Business", href: "#business" },
  { label: "Pricing", href: "/pricing" },
  { label: "Lab", href: "#lab" },
];

export function AnnouncementBar() {
  return (
    <div className="bg-forest text-cream text-xs sm:text-sm text-center py-2.5 px-4">
      <span className="font-medium">Shunbo Notetaker is now available on Windows and Mac.</span>
      <Link href="#notetaker" className="ml-3 underline-offset-4 hover:underline">
        Try for free ›
      </Link>
    </div>
  );
}

export function Nav() {
  const [mode, setMode] = useState<"dictation" | "notetaker">("dictation");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 px-3 sm:px-6 pt-3">
      <div
        className={cn(
          "mx-auto max-w-6xl rounded-2xl border border-ink/10 bg-cream-2/90 backdrop-blur-md transition-shadow",
          scrolled ? "shadow-[0_8px_30px_rgba(26,26,26,0.08)]" : "shadow-none",
        )}
      >
        <div className="flex items-center justify-between gap-4 px-4 sm:px-5 h-16">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" aria-label="Shunbo home">
              <Logo />
            </Link>
            <div className="hidden md:flex items-center rounded-pill border border-ink/15 p-1 text-sm">
              {(["dictation", "notetaker"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "relative rounded-pill px-3.5 py-1.5 capitalize transition-colors",
                    mode === m ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {mode === m && (
                    <motion.span
                      layoutId="nav-toggle"
                      className="absolute inset-0 rounded-pill bg-cream border border-ink/15 shadow-sm"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative">{m}</span>
                </button>
              ))}
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm">
            {LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="text-ink/80 hover:text-ink transition-colors">
                {l.label}
              </Link>
            ))}
            <Button href="/download" size="sm">
              <LayoutGrid className="size-4" />
              {BRAND.cta}
            </Button>
          </nav>

          <button
            type="button"
            className="md:hidden p-2 -mr-2"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden border-t border-ink/10"
            >
              <div className="flex flex-col gap-1 p-3">
                {LINKS.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-sm hover:bg-ink/5"
                  >
                    {l.label}
                  </Link>
                ))}
                <Button href="/download" className="mt-2 w-full">
                  {BRAND.cta}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
