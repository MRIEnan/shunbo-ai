-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN "detectedLanguage" TEXT,
ADD COLUMN "languages" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "MeetingSegment" ADD COLUMN "language" TEXT;

-- AlterTable
ALTER TABLE "MeetingNotes" ADD COLUMN "language" TEXT;

-- AlterTable
ALTER TABLE "Dictation" ADD COLUMN "detectedLanguage" TEXT;

-- CreateTable
CREATE TABLE "MeetingTranslation" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "targetLang" TEXT NOT NULL,
    "sourceLang" TEXT,
    "segments" JSONB NOT NULL,
    "notes" JSONB,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingTranslation_meetingId_targetLang_key" ON "MeetingTranslation"("meetingId", "targetLang");

-- AddForeignKey
ALTER TABLE "MeetingTranslation" ADD CONSTRAINT "MeetingTranslation_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
