"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Wrench, X } from "lucide-react";

type Toast = { id: number; message: string };
const EVENT = "shunbo:toast";
const FALLBACK = "Please wait for some time, maintenance is going on.";

/** Shows a toast from anywhere in the client: `showToast("…")`. */
export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

let patched = false;
/**
 * Any API response marked `x-shunbo-maintenance` (AI paused from the admin dashboard) raises the maintenance toast,
 * whichever component made the request. Components still receive the response and treat it as an error.
 */
function watchMaintenance() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await original(...args);
    if (res.status === 503 && res.headers.get("x-shunbo-maintenance") === "1") {
      res
        .clone()
        .json()
        .then((d: { error?: string }) => showToast(d.error ?? FALLBACK))
        .catch(() => showToast(FALLBACK));
    }
    return res;
  };
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    watchMaintenance();
    let n = 0;
    const onToast = (e: Event) => {
      const message = String((e as CustomEvent).detail ?? "");
      if (!message) return;
      const id = ++n;
      // One toast per message: repeated clicks refresh it instead of stacking.
      setToasts((t) => [...t.filter((x) => x.message !== message), { id, message }].slice(-3));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-cream shadow-lg"
          >
            <Wrench className="mt-0.5 size-4 shrink-0 text-lavender" aria-hidden />
            <span className="flex-1">{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-cream/60 hover:text-cream">
              <X className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
