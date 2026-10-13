import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing";
import { WebRecorderLoader } from "@/components/meetings/WebRecorderLoader";

export const metadata: Metadata = { title: "Record a meeting | Shunbo" };

export default async function NewMeetingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/meetings/new");
  const ent = await getEntitlement(session.user.id);
  return (
    <>
      <Link href="/meetings" className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
        <ArrowLeft className="size-4" /> All meetings
      </Link>
      <div className="mb-8 mt-3">
        <p className="eyebrow text-ink/60">Notetaker · browser</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Record a call in your browser</h1>
        <p className="mt-3 max-w-2xl text-ink/70">
          Works for calls that run in a browser tab, like Google Meet. You pick the tab and tick &ldquo;Share tab audio&rdquo;;
          we record that tab plus your microphone. For Zoom, Teams and other apps, use the desktop app.
        </p>
      </div>
      <WebRecorderLoader remainingMinutes={ent.meetingMinutesLimit === null ? null : Math.max(0, ent.meetingMinutesLimit - ent.meetingMinutesUsed)} />
    </>
  );
}
