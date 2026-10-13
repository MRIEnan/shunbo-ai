import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { auth, signIn } from "@/lib/auth";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Sign in | Shunbo" };

const ERRORS: Record<string, string> = {
  Verification: "That sign-in link is invalid or has expired. Request a new one below.",
  EmailSignin: "We couldn't send the email. Check the address and try again.",
  Default: "Something went wrong. Please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/app");
  const { error, callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-card border border-ink/10 bg-cream-2 p-8 sm:p-10">
        <Link href="/" aria-label="Shunbo home">
          <Logo />
        </Link>
        <h1 className="display mt-8 text-4xl">Sign in to Shunbo</h1>
        <p className="mt-3 text-sm text-ink/65">
          Enter your email and we&rsquo;ll send you a magic link. No password needed.
        </p>

        {error && (
          <p className="mt-5 rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm">{ERRORS[error] ?? ERRORS.Default}</p>
        )}

        <form
          className="mt-6 flex flex-col gap-3"
          action={async (formData) => {
            "use server";
            const email = String(formData.get("email") ?? "").trim().toLowerCase();
            const redirectTo = String(formData.get("callbackUrl") ?? "/app");
            await signIn("nodemailer", { email, redirectTo });
          }}
        >
          <input type="hidden" name="callbackUrl" value={callbackUrl?.startsWith("/") ? callbackUrl : "/app"} />
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 rounded-xl border border-ink/15 bg-cream px-4 text-sm outline-none focus:border-ink/40"
          />
          <button
            type="submit"
            className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-pill border border-ink/80 bg-lavender text-sm font-medium shadow-[0_2px_0_0_rgba(26,26,26,0.8)] hover:-translate-y-0.5 transition-all"
          >
            <Mail className="size-4" /> Send magic link
          </button>
        </form>

        <p className="mt-6 text-xs text-ink/60">
          By signing in you agree to our <Link href="#" className="underline">Terms</Link> and{" "}
          <Link href="#" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
