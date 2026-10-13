import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Monitor } from "lucide-react";
import { auth } from "@/lib/auth";
import { createApiToken } from "@/lib/session";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Connect desktop app | Shunbo" };

export default async function DesktopAuthPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/desktop/auth");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-card border border-ink/10 bg-cream-2 p-8 sm:p-10 text-center">
        <Link href="/" aria-label="Shunbo home" className="inline-block">
          <Logo />
        </Link>
        <div className="mx-auto mt-8 flex size-14 items-center justify-center rounded-full bg-lavender">
          <Monitor className="size-6" />
        </div>
        <h1 className="display mt-6 text-4xl">Connect the desktop app</h1>
        <p className="mt-3 text-sm text-ink/65">
          Signed in as <strong>{session.user.email}</strong>. Click below to link the Shunbo desktop app to this account.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            const s = await auth();
            if (!s?.user?.id) redirect("/signin?callbackUrl=/desktop/auth");
            const token = await createApiToken(s.user.id, "Desktop");
            // Hand the token to the next page through a short-lived httpOnly cookie so it never appears in a URL.
            (await cookies()).set("shunbo_desktop_handoff", token, { httpOnly: true, sameSite: "lax", maxAge: 120, path: "/desktop/auth" });
            redirect("/desktop/auth/handoff");
          }}
        >
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-pill border border-ink/80 bg-lavender text-sm font-medium shadow-[0_2px_0_0_rgba(26,26,26,0.8)]"
          >
            Connect this account
          </button>
        </form>
        <p className="mt-6 text-xs text-ink/60">
          Not you? <Link href="/signin" className="underline">Switch account</Link>
        </p>
      </div>
    </main>
  );
}
