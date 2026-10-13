"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/users", label: "Users" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="inline-flex rounded-pill border border-ink/15 bg-cream-2 p-1 text-sm">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn("rounded-pill px-4 py-1.5 transition-colors", pathname === t.href ? "bg-ink text-cream" : "text-ink/60 hover:text-ink")}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
