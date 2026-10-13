"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/app", label: "Dictate", auth: false },
  { href: "/history", label: "History", auth: true },
  { href: "/settings", label: "Settings", auth: true },
  { href: "/admin", label: "Admin", auth: true, admin: true },
];

export function AppNavLinks({ signedIn, isAdmin = false }: { signedIn: boolean; isAdmin?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm">
      {LINKS.filter((l) => (!l.auth || signedIn) && (!("admin" in l && l.admin) || isAdmin)).map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "rounded-pill px-3 py-1.5 transition-colors",
            pathname === l.href || pathname.startsWith(l.href + "/") ? "bg-ink/5 text-ink" : "text-ink/60 hover:text-ink",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
