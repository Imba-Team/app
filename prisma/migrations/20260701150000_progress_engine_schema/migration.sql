-- CreateEnum
CREATE TYPE "CardMasteryStatus" AS ENUM ('NEW', 'LEARNING', 'MASTERED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StudySessionMode" ADD VALUE 'WRITE';
ALTER TYPE "StudySessionMode" ADD VALUE 'SPELL';
ALTER TYPE "StudySessionMode" ADD VALUE 'AI_FILL_BLANK';
ALTER TYPE "StudySessionMode" ADD VALUE 'AI_GUESS_WORD';

-- DropForeignKey
ALTER TABLE "flashcard_user_state" DROP CONSTRAINT "flashcard_user_state_flashcardId_fkey";

-- DropForeignKey
ALTER TABLE "flashcard_user_state" DROP CONSTRAINT "flashcard_user_state_userId_fkey";

-- DropTable
DROP TABLE "flashcard_user_state";

-- CreateTable
CREATE TABLE "user_card_progress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "status" "CardMasteryStatus" NOT NULL DEFAULT 'NEW',
    "weightedStreak" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "hintsUsedCount" INTEGER NOT NULL DEFAULT 0,
    "timesDemoted" INTEGER NOT NULL DEFAULT 0,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "lastStudyMode" "StudySessionMode",
    "lastAttemptedAt" TIMESTAMP(3),
    "masteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_card_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_set_progress" (
    "userId" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "totalCards" INTEGER NOT NULL,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "learningCount" INTEGER NOT NULL DEFAULT 0,
    "masteredCount" INTEGER NOT NULL DEFAULT 0,
    "lastStudiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_set_progress_pkey" PRIMARY KEY ("userId","setId")
);

-- CreateTable
CREATE TABLE "srs_card" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "easeFactor" DECIMAL(4,2) NOT NULL DEFAULT 2.50,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "dueDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewed" TIMESTAMP(3),
    "retentionProb" DECIMAL(4,3) NOT NULL DEFAULT 1.000,
    "stability" DECIMAL(6,2) NOT NULL DEFAULT 1.0,
    "isLeech" BOOLEAN NOT NULL DEFAULT false,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "srs_card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_card_progress_userId_setId_status_idx" ON "user_card_progress"("userId", "setId", "status");

-- CreateIndex
CREATE INDEX "user_card_progress_userId_isStarred_idx" ON "user_card_progress"("userId", "isStarred");

-- CreateIndex
CREATE UNIQUE INDEX "user_card_progress_userId_cardId_key" ON "user_card_progress"("userId", "cardId");

-- CreateIndex
CREATE INDEX "srs_card_userId_dueDate_idx" ON "srs_card"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "srs_card_userId_cardId_key" ON "srs_card"("userId", "cardId");

-- AddForeignKey
ALTER TABLE "user_card_progress" ADD CONSTRAINT "user_card_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_card_progress" ADD CONSTRAINT "user_card_progress_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_card_progress" ADD CONSTRAINT "user_card_progress_setId_fkey" FOREIGN KEY ("setId") REFERENCES "study_set"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_set_progress" ADD CONSTRAINT "user_set_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_set_progress" ADD CONSTRAINT "user_set_progress_setId_fkey" FOREIGN KEY ("setId") REFERENCES "study_set"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "srs_card" ADD CONSTRAINT "srs_card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "srs_card" ADD CONSTRAINT "srs_card_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
