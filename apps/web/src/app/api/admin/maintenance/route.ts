import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getMaintenance, setMaintenance } from "@/lib/maintenance";

export const runtime = "nodejs";

export async function GET() {
  const { admin, response } = await requireAdmin();
  if (!admin) return response;
  return NextResponse.json(await getMaintenance(true));
}

/** Body: { enabled: boolean, message?: string } */
export async function PUT(req: Request) {
  const { admin, response } = await requireAdmin();
  if (!admin) return response;
  const b = await req.json().catch(() => ({}));
  if (typeof b.enabled !== "boolean") return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 });
  const state = await setMaintenance(b.enabled, typeof b.message === "string" ? b.message : undefined, admin.email ?? admin.id ?? null);
  console.info(`[maintenance] ${state.enabled ? "ON" : "OFF"} by ${admin.email}`);
  return NextResponse.json(state);
}
