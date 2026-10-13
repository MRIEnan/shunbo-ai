import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Verify your email | Shunbo" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <AuthShell
      title="Check your email"
      subtitle={<>We sent a 6-digit code to <strong>{email ?? "your address"}</strong>. Enter it below. It expires in 10 minutes.</>}
    >
      <Suspense>
        <VerifyForm />
      </Suspense>
    </AuthShell>
  );
}
