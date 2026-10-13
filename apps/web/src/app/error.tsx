"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-card border border-ink/10 bg-cream-2 p-8 sm:p-10 text-center">
        <Link href="/" aria-label="Shunbo home" className="inline-block">
          <Logo />
        </Link>
        <h1 className="display mt-8 text-4xl">Something went wrong.</h1>
        <p className="mt-3 text-sm text-ink/65">
          We hit an unexpected error. It has been logged. Try again, or head back home.
        </p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-ink/60">ref {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-pill bg-ink px-4 text-sm text-cream">
            <RotateCcw className="size-4" /> Try again
          </button>
          <Link href="/" className="inline-flex h-10 items-center rounded-pill border border-ink/20 px-4 text-sm">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
