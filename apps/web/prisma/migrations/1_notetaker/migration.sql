-- AlterTable
ALTER TABLE "PlanConfig" ADD COLUMN     "meetingMinutesPerMonth" INTEGER;

-- AlterTable
ALTER TABLE "UsageRecord" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'dictation',
ADD COLUMN     "seconds" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "words" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'recording',
    "source" TEXT NOT NULL DEFAULT 'desktop',
    "language" TEXT,
    "diarize" BOOLEAN NOT NULL DEFAULT true,
    "durationSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingChunk" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "track" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingSegment" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "track" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "startSec" DOUBLE PRECISION NOT NULL,
    "endSec" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "MeetingSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingNotes" (
    "meetingId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actionItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decisions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "questions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingNotes_pkey" PRIMARY KEY ("meetingId")
);

-- CreateIndex
CREATE INDEX "Meeting_userId_startedAt_idx" ON "Meeting"("userId", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingChunk_meetingId_index_track_key" ON "MeetingChunk"("meetingId", "index", "track");

-- CreateIndex
CREATE INDEX "MeetingSegment_meetingId_startSec_idx" ON "MeetingSegment"("meetingId", "startSec");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingChunk" ADD CONSTRAINT "MeetingChunk_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSegment" ADD CONSTRAINT "MeetingSegment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingNotes" ADD CONSTRAINT "MeetingNotes_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

