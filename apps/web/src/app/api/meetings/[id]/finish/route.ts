import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { finalizeMeeting } from "@/lib/meeting-finish";
import { maintenanceGuard } from "@/lib/maintenance";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Ends the meeting and generates notes (in the meeting's language). Minutes were metered per chunk during recording. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  const meeting = await prisma.meeting.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // AI paused from the admin dashboard: refuse before any OpenAI call.
  const paused = await maintenanceGuard();
  if (paused) return paused;
  const b = await req.json().catch(() => ({}));
  const r = await finalizeMeeting(id, { durationSec: typeof b.durationSec === "number" ? b.durationSec : 0, regenerate: b.regenerate === true });
  if (r.status === "failed") return NextResponse.json({ error: r.error }, { status: r.error === "Not found" ? 404 : 502 });
  return NextResponse.json({ ok: true, status: "done", ...(r.notes ? { notes: r.notes, language: r.language } : {}) });
}
