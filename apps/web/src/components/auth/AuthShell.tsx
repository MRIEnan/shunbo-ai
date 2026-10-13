import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function AuthShell({ title, subtitle, children }: { title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-card border border-ink/10 bg-cream-2 p-8 sm:p-10">
        <Link href="/" aria-label="Shunbo home">
          <Logo />
        </Link>
        <h1 className="display mt-8 text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 text-sm text-ink/65">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
