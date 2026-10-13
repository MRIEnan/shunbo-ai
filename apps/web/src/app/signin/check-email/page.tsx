import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Check your email | Shunbo" };

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-card border border-ink/10 bg-cream-2 p-8 sm:p-10 text-center">
        <Link href="/" aria-label="Shunbo home" className="inline-block">
          <Logo />
        </Link>
        <div className="mx-auto mt-8 flex size-14 items-center justify-center rounded-full bg-lavender">
          <MailCheck className="size-6" />
        </div>
        <h1 className="display mt-6 text-4xl">Check your email</h1>
        <p className="mt-3 text-sm text-ink/65">
          We sent you a sign-in link. Open it on this device to finish signing in. It expires in 24 hours.
        </p>
        <p className="mt-6 text-xs text-ink/60">
          Didn&rsquo;t get it? Check your spam folder or{" "}
          <Link href="/signin" className="underline">
            try again
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
