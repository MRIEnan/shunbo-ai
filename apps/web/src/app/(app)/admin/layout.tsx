import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin";
import { AdminTabs } from "@/components/admin/AdminTabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) redirect("/app");
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-ink/60">Admin</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">Dashboard</h1>
        </div>
        <Link href="/pricing" className="text-sm text-ink/60 hover:text-ink">
          View public pricing page
        </Link>
      </div>
      <AdminTabs />
      <div className="mt-6">{children}</div>
    </>
  );
}
