import { getPlans } from "@/lib/billing";
import { AdminPlans } from "@/components/admin/AdminPlans";

export default async function AdminPlansPage() {
  const plans = await getPlans(true);
  return <AdminPlans initial={plans} stripeConfigured={!!process.env.STRIPE_SECRET_KEY} />;
}
