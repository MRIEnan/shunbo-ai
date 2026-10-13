import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";
import { TERMS } from "@/content/legal";

export const metadata: Metadata = {
  title: "Terms of Service | Shunbo AI",
  description: "The terms that apply when you use Shunbo.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms govern your use of Shunbo's website, web app and desktop app. Please read them together with our Privacy Policy."
      sections={TERMS}
    />
  );
}
