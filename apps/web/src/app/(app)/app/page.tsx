import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { DictationLoader } from "@/components/app/DictationLoader";

export const metadata: Metadata = {
  title: "Shunbo | Dictate in your browser",
  description: "Speak naturally and get clean, polished text. Free to try, no account needed.",
};

export default async function AppPage() {
  const session = await auth();
  const signedIn = !!session?.user?.id;
  return (
    <>
      <div className="mb-8">
        <p className="eyebrow text-ink/60">Web dictation</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">
          Speak. <em className="italic">We&rsquo;ll write.</em>
        </h1>
        <p className="mt-3 max-w-xl text-ink/70">
          Press the mic, talk like you normally would, and get text that reads like you typed it. Audio is sent to our
          servers for transcription and is not stored.
        </p>
      </div>
      <DictationLoader signedIn={signedIn} />
    </>
  );
}
