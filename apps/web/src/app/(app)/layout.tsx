import Link from "next/link";
import { LogOut } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { Logo } from "@/components/ui/Logo";
import { Container } from "@/components/ui/Container";
import { AppNavLinks } from "@/components/app/AppNavLinks";
import { isAdminUser } from "@/lib/admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user ?? null;
  const admin = user ? await isAdminUser(user.id, user.email) : false;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/90 backdrop-blur">
        <Container className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" aria-label="Shunbo home">
              <Logo />
            </Link>
            <AppNavLinks signedIn={!!user} isAdmin={admin} />
          </div>
          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="hidden sm:inline text-ink/60 truncate max-w-[14rem]">{user.email}</span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/app" });
                  }}
                >
                  <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-ink/15 px-3 text-xs hover:bg-ink/5">
                    <LogOut className="size-3.5" /> Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link href="/signin" className="inline-flex h-9 items-center rounded-pill bg-ink px-4 text-xs font-medium text-cream hover:bg-ink-2">
                Sign in
              </Link>
            )}
          </div>
        </Container>
      </header>
      <main className="py-8 sm:py-12">
        <Container>{children}</Container>
      </main>
    </>
  );
}
