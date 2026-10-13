import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset password | Shunbo" };

export default function ForgotPage() {
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send a 6-digit code to set a new one.">
      <Suspense>
        <ForgotForm />
      </Suspense>
    </AuthShell>
  );
}
