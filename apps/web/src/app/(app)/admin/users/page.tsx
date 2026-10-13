import { getPlans } from "@/lib/billing";
import { AdminUsers } from "@/components/admin/AdminUsers";

export default async function AdminUsersPage() {
  const plans = await getPlans(true);
  return <AdminUsers plans={plans.map((p) => ({ slug: p.slug, name: p.name }))} />;
}
