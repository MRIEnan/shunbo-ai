import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MeetingView } from "@/components/meetings/MeetingView";

export const metadata: Metadata = { title: "Meeting | Shunbo" };

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/meetings/${id}`);
  const exists = await prisma.meeting.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!exists) notFound();
  return <MeetingView id={id} />;
}
