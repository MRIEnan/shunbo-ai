import { NextResponse, type NextRequest } from "next/server";

/**
 * CORS for the desktop app. The Tauri webview runs on its own origin
 * (http://tauri.localhost on Windows, tauri://localhost on macOS) and authenticates
 * with a bearer token, so cookies are never involved and credentials stay false.
 */
const ALLOWED = new Set(["http://tauri.localhost", "https://tauri.localhost", "tauri://localhost"]);
const extra = (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
for (const o of extra) ALLOWED.add(o);
// `tauri dev` serves the UI from the Vite dev server, so the webview's origin is localhost:1420.
if (process.env.NODE_ENV !== "production") ALLOWED.add("http://localhost:1420");

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function proxy(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  if (!ALLOWED.has(origin)) return NextResponse.next();

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/api/:path*" };
