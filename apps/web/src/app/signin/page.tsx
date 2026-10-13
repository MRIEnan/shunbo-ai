import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Sign in | Shunbo" };

const ERRORS: Record<string, string> = {
  Verification: "That sign-in link is invalid or has expired. Request a new one below.",
  EmailSignin: "We couldn't send the email. Check the address and try again.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const session = await auth();
  const { error, callbackUrl } = await searchParams;
  if (session?.user) redirect(callbackUrl?.startsWith("/") ? callbackUrl : "/app");
  return (
    <AuthShell title="Sign in to Shunbo" subtitle="Use your password, or get a one-time sign-in link by email.">
      {error && <p className="mb-4 rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm">{ERRORS[error] ?? "Something went wrong. Please try again."}</p>}
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
