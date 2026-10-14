import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { meetingToMarkdown } from "@/lib/meetings";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  const owned = await prisma.meeting.findFirst({ where: { id, userId: user.id }, select: { title: true } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const lang = new URL(req.url).searchParams.get("lang");
  const md = await meetingToMarkdown(id, lang && lang !== "original" ? lang : null);
  const filename = `${owned.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "meeting"}.md`;
  return new NextResponse(md, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
