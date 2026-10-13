import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getPlans, getEntitlement } from "@/lib/billing";
import { Container } from "@/components/ui/Container";
import { PlanCards } from "@/components/billing/PlanCards";

export const metadata: Metadata = {
  title: "Pricing | Shunbo AI",
  description: "Start free. Upgrade to Pro for unlimited dictation.",
};

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const [session, plans, { billing }] = await Promise.all([auth(), getPlans(), searchParams]);
  const ent = session?.user?.id ? await getEntitlement(session.user.id) : null;

  return (
    <>
      <main className="py-16 sm:py-24">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-ink/60">Pricing</p>
            <h1 className="display mt-5 text-[clamp(2.75rem,7vw,5rem)]">
              Start free. <em className="italic">Talk more for less.</em>
            </h1>
            <p className="mt-6 text-lg text-ink/75">
              Every plan includes dictation on web and desktop, 100+ languages, vocabulary and snippets.
            </p>
            {billing === "cancelled" && (
              <p className="mt-6 inline-block rounded-pill bg-sand-2 px-4 py-2 text-sm">Checkout cancelled. No charges were made.</p>
            )}
          </div>
          <div className="mt-14">
            <PlanCards plans={plans} currentPlan={ent?.plan.slug ?? null} signedIn={!!session?.user} />
          </div>
          <p className="mt-10 text-center text-xs text-ink/60">
            Prices in USD. Cancel anytime from your billing portal. Word limits reset every Monday.
          </p>
        </Container>
      </main>
    </>
  );
}
