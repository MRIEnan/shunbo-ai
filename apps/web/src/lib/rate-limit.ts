/**
 * Sliding-window rate limiter.
 *
 * With UPSTASH_REDIS_REST_URL/TOKEN set, counts are shared across serverless instances
 * (fixed window per key via INCR + EXPIRE, which is good enough for abuse protection).
 * Otherwise an in-memory window is used, which is per-process only.
 */
const buckets = new Map<string, number[]>();

const upstash =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? { url: process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, ""), token: process.env.UPSTASH_REDIS_REST_TOKEN }
    : null;

type Result = { ok: true } | { ok: false; retryAfterMs: number };

async function redisLimit(key: string, limit: number, windowMs: number): Promise<Result> {
  const windowSec = Math.ceil(windowMs / 1000);
  const slot = Math.floor(Date.now() / windowMs);
  const k = `rl:${key}:${slot}`;
  const res = await fetch(`${upstash!.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${upstash!.token}`, "Content-Type": "application/json" },
    body: JSON.stringify([["INCR", k], ["EXPIRE", k, windowSec]]),
  });
  if (!res.ok) return { ok: true }; // fail open: never block users because Redis is down
  const data = (await res.json()) as { result: number }[];
  const count = data[0]?.result ?? 0;
  if (count > limit) return { ok: false, retryAfterMs: windowMs - (Date.now() % windowMs) };
  return { ok: true };
}

function memoryLimit(key: string, limit: number, windowMs: number): Result {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfterMs: windowMs - (now - hits[0]) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) buckets.clear(); // crude memory guard
  return { ok: true };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<Result> {
  if (upstash) {
    try {
      return await redisLimit(key, limit, windowMs);
    } catch {
      return memoryLimit(key, limit, windowMs);
    }
  }
  return memoryLimit(key, limit, windowMs);
}

export function clientKey(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}
