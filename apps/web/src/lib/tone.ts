import type { Tone as DbTone } from "@prisma/client";
import type { Tone } from "./prompts";

export const toDbTone = (t: Tone): DbTone => (t === "very-casual" ? "very_casual" : t);
export const fromDbTone = (t: DbTone): Tone => (t === "very_casual" ? "very-casual" : t);

export const countWords = (s: string) => (s.trim().match(/\S+/g) ?? []).length;
