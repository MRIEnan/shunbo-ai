"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";

export function DesktopHandoff({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const deepLink = `shunbo://auth?token=${encodeURIComponent(token)}`;

  useEffect(() => {
    // Expire the handoff cookie and try to open the app.
    document.cookie = "shunbo_desktop_handoff=; path=/desktop/auth; max-age=0";
    const t = setTimeout(() => window.location.assign(deepLink), 300);
    return () => clearTimeout(t);
  }, [deepLink]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <h1 className="display mt-8 text-4xl">Opening Shunbo…</h1>
      <p className="mt-3 text-sm text-ink/65">
        If the desktop app didn&rsquo;t open,{" "}
        <a href={deepLink} className="underline">
          click here
        </a>{" "}
        or paste this code into the app&rsquo;s sign-in screen.
      </p>
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-ink/15 bg-cream p-2">
        <code className="flex-1 truncate px-2 text-left text-xs">{token}</code>
        <button type="button" onClick={copy} className="inline-flex h-8 items-center gap-1 rounded-pill border border-ink/15 px-3 text-xs">
          {copied ? <Check className="size-3.5 text-forest" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-6 text-xs text-ink/60">This code works once and can be revoked from the desktop app. You can close this tab afterwards.</p>
    </>
  );
}
