-- 1) Per-attempt outcome enum shared with the CardAttempt log
CREATE TYPE "AttemptOutcomeStatus" AS ENUM ('CORRECT', 'INCORRECT', 'SKIPPED');

-- 2) Author-provided alternate accepted answers for the written evaluator.
-- Default empty array so existing rows are valid without a backfill.
ALTER TABLE "flashcard"
  ADD COLUMN "alternateAnswers" TEXT[] NOT NULL DEFAULT '{}';

-- 3) Per-attempt audit log. One row per learner answer, written on both
-- MC and written submissions. Powers analytics, adaptive prompt
-- selection, and session replay.
CREATE TABLE "card_attempt" (
  "id"           UUID                   NOT NULL DEFAULT gen_random_uuid(),
  "sessionId"    UUID                   NOT NULL,
  "userId"       UUID                   NOT NULL,
  "cardId"       UUID                   NOT NULL,
  "setId"        UUID                   NOT NULL,
  "studyMode"    VARCHAR                NOT NULL,
  "outcome"      "AttemptOutcomeStatus" NOT NULL,
  "hintUsed"     BOOLEAN                NOT NULL DEFAULT false,
  "responseMs"   INTEGER,
  "similarity"   DECIMAL(4,3),
  "editDistance" INTEGER,
  "createdAt"    TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "card_attempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "card_attempt_userId_cardId_createdAt_idx"
  ON "card_attempt" ("userId", "cardId", "createdAt");

CREATE INDEX "card_attempt_sessionId_createdAt_idx"
  ON "card_attempt" ("sessionId", "createdAt");

ALTER TABLE "card_attempt"
  ADD CONSTRAINT "card_attempt_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "study_session"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "card_attempt"
  ADD CONSTRAINT "card_attempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "card_attempt"
  ADD CONSTRAINT "card_attempt_cardId_fkey"
  FOREIGN KEY ("cardId") REFERENCES "flashcard"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
