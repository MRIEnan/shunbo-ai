"use client";

import type { Tone } from "./prompts";

export type Dictation = {
  id: string;
  raw: string;
  clean: string;
  tone: Tone;
  durationSec: number;
  createdAt: number;
  detectedLanguage?: string | null;
};

export type Settings = {
  tone: Tone;
  language: string; // "auto" or ISO-639-1
  autoCopy: boolean;
  vocabulary: string[];
};

const HISTORY_KEY = "shunbo.history";
const SETTINGS_KEY = "shunbo.settings";
const USAGE_KEY = "shunbo.usage";

export const FREE_ANON_LIMIT = 5;

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export const defaultSettings: Settings = { tone: "casual", language: "auto", autoCopy: true, vocabulary: [] };

export const store = {
  getHistory: () => read<Dictation[]>(HISTORY_KEY, []),
  addDictation(d: Dictation) {
    const list = [d, ...store.getHistory()].slice(0, 200);
    write(HISTORY_KEY, list);
    return list;
  },
  removeDictation(id: string) {
    const list = store.getHistory().filter((d) => d.id !== id);
    write(HISTORY_KEY, list);
    return list;
  },
  clearHistory() {
    write(HISTORY_KEY, []);
  },
  getSettings: () => ({ ...defaultSettings, ...read<Partial<Settings>>(SETTINGS_KEY, {}) }),
  setSettings(s: Settings) {
    write(SETTINGS_KEY, s);
  },
  getUsage: () => read<number>(USAGE_KEY, 0),
  bumpUsage() {
    const n = store.getUsage() + 1;
    write(USAGE_KEY, n);
    return n;
  },
};

export { LANGUAGES } from "./languages";
