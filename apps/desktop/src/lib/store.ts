import { LazyStore } from "@tauri-apps/plugin-store";

export type Tone = "formal" | "casual" | "very-casual";

export type Prefs = {
  apiUrl: string;
  token: string | null;
  email: string | null;
  tone: Tone;
  language: string;
  shortcut: string;
  pasteMode: "paste" | "clipboard"; // paste = Ctrl+V into active app; clipboard = copy only
  notetakerConsent: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3100",
  token: null,
  email: null,
  tone: "casual",
  language: "auto",
  shortcut: "CommandOrControl+Shift+Space",
  pasteMode: "paste",
  notetakerConsent: false,
};

const store = new LazyStore("prefs.json");

export async function loadPrefs(): Promise<Prefs> {
  const saved = (await store.get<Partial<Prefs>>("prefs")) ?? {};
  return { ...DEFAULT_PREFS, ...saved };
}

export async function savePrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await loadPrefs()), ...patch };
  await store.set("prefs", next);
  await store.save();
  return next;
}
