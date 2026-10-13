"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const DictationApp = dynamic(() => import("./Dictation").then((m) => m.DictationApp), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center text-ink/60">
      <Loader2 className="size-6 animate-spin" />
    </div>
  ),
});

export function DictationLoader({ signedIn }: { signedIn: boolean }) {
  return <DictationApp signedIn={signedIn} />;
}
