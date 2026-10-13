import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";
import { PRIVACY } from "@/content/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | Shunbo AI",
  description: "What Shunbo collects, how it is used, and your choices.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="Shunbo AI provides voice dictation and meeting-notes software: a website at shunboai.com, a web app, and a Windows desktop app (together, the Service). This policy explains what we collect, why, and the choices you have."
      sections={PRIVACY}
    />
  );
}
