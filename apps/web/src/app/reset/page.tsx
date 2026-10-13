import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Set a new password | Shunbo" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <AuthShell
      title="Set a new password"
      subtitle={<>Enter the code we sent to <strong>{email ?? "your email"}</strong> and choose a new password.</>}
    >
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
