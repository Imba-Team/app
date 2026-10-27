-- Progress analytics (MIM-17/55/56): a per-rating SRS review log, nightly
-- per-set mastery snapshots, and indexes for the per-day activity queries.

-- CreateTable
CREATE TABLE "user_set_progress_snapshot" (
    "userId" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "newCount" INTEGER NOT NULL,
    "learningCount" INTEGER NOT NULL,
    "masteredCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_set_progress_snapshot_pkey" PRIMARY KEY ("userId","setId","date")
);

-- CreateTable
CREATE TABLE "srs_review_log" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "rating" VARCHAR(8) NOT NULL,
    "source" VARCHAR(16) NOT NULL,
    "intervalBefore" INTEGER NOT NULL,
    "intervalAfter" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "srs_review_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_set_progress_snapshot_userId_date_idx" ON "user_set_progress_snapshot"("userId", "date");

-- CreateIndex
CREATE INDEX "srs_review_log_userId_reviewedAt_idx" ON "srs_review_log"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "study_session_userId_completedAt_idx" ON "study_session"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "card_attempt_userId_createdAt_idx" ON "card_attempt"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "user_set_progress_snapshot" ADD CONSTRAINT "user_set_progress_snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_set_progress_snapshot" ADD CONSTRAINT "user_set_progress_snapshot_setId_fkey" FOREIGN KEY ("setId") REFERENCES "study_set"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "srs_review_log" ADD CONSTRAINT "srs_review_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "srs_review_log" ADD CONSTRAINT "srs_review_log_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

