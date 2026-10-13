import type { Metadata } from "next";
import { Figtree, EB_Garamond } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Shunbo AI | Voice to Text Dictation & AI Notetaker",
  description:
    "Shunbo is the voice-to-text AI that turns your speech into clear, polished writing in every app. 4x faster than typing.",
  openGraph: {
    title: "Shunbo AI | Don't type, just speak.",
    description:
      "The voice-to-text AI that turns speech into clear, polished writing in every app.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${garamond.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">{children}</body>
    </html>
  );
}
