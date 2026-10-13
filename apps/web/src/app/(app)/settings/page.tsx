import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsPanel } from "@/components/app/SettingsPanel";
import { fromDbTone } from "@/lib/tone";
import { getEntitlement } from "@/lib/billing";
import { BillingCard } from "@/components/billing/BillingCard";

export const metadata: Metadata = { title: "Settings | Shunbo" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/settings");
  const userId = session.user.id;

  const [settings, vocabulary, snippets, presets, ent, { billing }] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.vocabularyWord.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.snippet.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.stylePreset.findMany({ where: { userId }, orderBy: { context: "asc" } }),
    getEntitlement(userId),
    searchParams,
  ]);

  return (
    <>
      <div className="mb-8">
        <p className="eyebrow text-ink/60">Make Shunbo yours</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Settings</h1>
      </div>
      <div className="mb-5">
        <BillingCard
          planName={ent.plan.name}
          planSlug={ent.plan.slug}
          status={ent.status}
          used={ent.used}
          limit={ent.limit}
          cancelAtPeriodEnd={ent.cancelAtPeriodEnd}
          currentPeriodEnd={ent.currentPeriodEnd}
          hasStripeCustomer={ent.hasStripeCustomer}
          justUpgraded={billing === "success"}
        />
      </div>
      <SettingsPanel
        email={session.user.email ?? ""}
        planName={ent.plan.name}
        settings={{
          tone: settings ? fromDbTone(settings.tone) : "casual",
          language: settings?.language ?? "auto",
          autoCopy: settings?.autoCopy ?? true,
        }}
        vocabulary={vocabulary.map((w) => ({ id: w.id, word: w.word }))}
        snippets={snippets.map((s) => ({ id: s.id, trigger: s.trigger, expansion: s.expansion }))}
        presets={presets.map((p) => ({ id: p.id, context: p.context, tone: fromDbTone(p.tone), instructions: p.instructions ?? "" }))}
      />
    </>
  );
}
