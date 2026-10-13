import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Create account | Shunbo" };

export default async function SignUpPage() {
  const session = await auth();
  if (session?.user) redirect("/app");
  return (
    <AuthShell title="Create your account" subtitle="Free to start. No credit card needed.">
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-ink/60">
        Already have an account? <Link href="/signin" className="underline">Sign in</Link>
      </p>
      <p className="mt-4 text-xs text-ink/60">
        By creating an account you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </AuthShell>
  );
}
