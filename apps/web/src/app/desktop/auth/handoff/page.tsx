import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Logo } from "@/components/ui/Logo";
import { DesktopHandoff } from "@/components/app/DesktopHandoff";

export const metadata: Metadata = { title: "Opening Shunbo | Shunbo" };

export default async function HandoffPage() {
  const jar = await cookies();
  const token = jar.get("shunbo_desktop_handoff")?.value;
  if (!token) redirect("/desktop/auth");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-card border border-ink/10 bg-cream-2 p-8 sm:p-10 text-center">
        <Link href="/" aria-label="Shunbo home" className="inline-block">
          <Logo />
        </Link>
        <DesktopHandoff token={token} />
      </div>
    </main>
  );
}
