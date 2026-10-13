"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Client-only: the recorder reads browser capabilities and localStorage, which the server can't know.
const WebRecorder = dynamic(() => import("./WebRecorder").then((m) => m.WebRecorder), {
  ssr: false,
  loading: () => (
    <div className="flex h-48 items-center justify-center text-ink/60">
      <Loader2 className="size-6 animate-spin" />
    </div>
  ),
});

export function WebRecorderLoader({ remainingMinutes }: { remainingMinutes: number | null }) {
  return <WebRecorder remainingMinutes={remainingMinutes} />;
}
