import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-card border border-ink/10 bg-cream-2 p-8 sm:p-10 text-center">
        <Link href="/" aria-label="Shunbo home" className="inline-block">
          <Logo />
        </Link>
        <p className="eyebrow mt-8 text-ink/60">404</p>
        <h1 className="display mt-3 text-4xl">
          We didn&rsquo;t catch <em className="italic">that.</em>
        </h1>
        <p className="mt-3 text-sm text-ink/65">That page doesn&rsquo;t exist or has moved.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className="inline-flex h-10 items-center rounded-pill bg-ink px-4 text-sm text-cream">
            Home
          </Link>
          <Link href="/app" className="inline-flex h-10 items-center rounded-pill border border-ink/20 px-4 text-sm">
            Open the app
          </Link>
        </div>
      </div>
    </main>
  );
}
