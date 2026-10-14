-- AlterTable
ALTER TABLE "MeetingChunk" ADD COLUMN "meteredSec" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AnonymousUsage" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymousUsage_pkey" PRIMARY KEY ("key")
);

-- Pro fair use (admin-editable afterwards): unlimited rows become the fair-use defaults.
UPDATE "PlanConfig" SET "wordsPerWeek" = 100000 WHERE "slug" = 'pro' AND "wordsPerWeek" IS NULL;
UPDATE "PlanConfig" SET "meetingMinutesPerMonth" = 2400 WHERE "slug" = 'pro' AND "meetingMinutesPerMonth" IS NULL;
UPDATE "PlanConfig" SET "features" = array_replace(array_replace("features", 'Unlimited words', '100,000 words per week (fair use)'), 'Unlimited meeting minutes', '40 hours of meetings per month (fair use)') WHERE "slug" = 'pro';
