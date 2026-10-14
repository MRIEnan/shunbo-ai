import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * AI maintenance switch (admin dashboard). While it is on, every feature that would call OpenAI is refused before
 * any API call is made: dictation, cleanup, starting/recording/finishing meetings, notes and translation.
 * The value is cached per server instance for a few seconds, so a toggle reaches every instance within CACHE_MS.
 */
export type MaintenanceState = { enabled: boolean; message: string; since: string | null };

const KEY = "maintenance";
const CACHE_MS = 5_000;
export const DEFAULT_MAINTENANCE_MESSAGE = "Please wait for some time, maintenance is going on.";
let cache: { at: number; value: MaintenanceState } | null = null;

export async function getMaintenance(fresh = false): Promise<MaintenanceState> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  let value: MaintenanceState = { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE, since: null };
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
    const v = (row?.value ?? {}) as Partial<MaintenanceState>;
    value = {
      enabled: v.enabled === true,
      message: typeof v.message === "string" && v.message.trim() ? v.message : DEFAULT_MAINTENANCE_MESSAGE,
      since: typeof v.since === "string" ? v.since : null,
    };
  } catch (e) {
    // Fail open: a database hiccup must not take every AI feature down.
    console.warn("[maintenance] read failed", e instanceof Error ? e.message : e);
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function setMaintenance(enabled: boolean, message: string | undefined, updatedBy: string | null): Promise<MaintenanceState> {
  const prev = await getMaintenance(true);
  const value: MaintenanceState = {
    enabled,
    message: message?.trim() ? message.trim().slice(0, 200) : DEFAULT_MAINTENANCE_MESSAGE,
    since: enabled ? (prev.enabled && prev.since ? prev.since : new Date().toISOString()) : null,
  };
  await prisma.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value, updatedBy }, update: { value, updatedBy } });
  cache = { at: Date.now(), value };
  return value;
}

/**
 * For API routes: returns a 503 response when AI features are paused, else null.
 * The `x-shunbo-maintenance` header lets the site show a toast for any request, whichever component made it.
 */
export async function maintenanceGuard(): Promise<NextResponse | null> {
  const m = await getMaintenance();
  if (!m.enabled) return null;
  return NextResponse.json(
    { error: m.message, code: "maintenance" },
    { status: 503, headers: { "x-shunbo-maintenance": "1", "Retry-After": "300", "Cache-Control": "no-store" } },
  );
}
