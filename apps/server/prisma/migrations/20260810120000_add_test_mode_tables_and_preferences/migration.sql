-- 1) Test Mode enums.
CREATE TYPE "TestAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');
CREATE TYPE "TestQuestionType" AS ENUM (
  'TEST_MC',
  'TEST_WRITTEN',
  'TEST_TF',
  'TEST_MATCH'
);

-- 2) Extend existing TestAttempt with lifecycle + cached counts.
ALTER TABLE "test_attempt"
  ADD COLUMN "status"          "TestAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN "correctCount"    INTEGER             NOT NULL DEFAULT 0,
  ADD COLUMN "incorrectCount"  INTEGER             NOT NULL DEFAULT 0,
  ADD COLUMN "questionCount"   INTEGER             NOT NULL DEFAULT 0,
  ADD COLUMN "durationSeconds" INTEGER,
  ADD COLUMN "submittedAt"     TIMESTAMP(3);

-- Backfill: any existing attempts (client-only history from before
-- the overhaul) count as already completed at their creation time so
-- the sweep doesn't retroactively abandon them.
UPDATE "test_attempt"
SET "status"        = 'COMPLETED',
    "questionCount" = "totalQuestions",
    "submittedAt"   = "createdAt";

CREATE INDEX "test_attempt_userId_createdAt_idx"
  ON "test_attempt" ("userId", "createdAt");
CREATE INDEX "test_attempt_userId_studySetId_createdAt_idx"
  ON "test_attempt" ("userId", "studySetId", "createdAt");
CREATE INDEX "test_attempt_userId_status_idx"
  ON "test_attempt" ("userId", "status");

-- 3) Extend TestQuestionAttempt with question metadata + fix cascade.
ALTER TABLE "test_question_attempt"
  ADD COLUMN "questionType"        "TestQuestionType"     NOT NULL DEFAULT 'TEST_WRITTEN',
  ADD COLUMN "promptText"          TEXT                   NOT NULL DEFAULT '',
  ADD COLUMN "expectedAnswer"      TEXT                   NOT NULL DEFAULT '',
  ADD COLUMN "choices"             TEXT[]                 NOT NULL DEFAULT '{}',
  ADD COLUMN "correctChoiceIndex"  INTEGER,
  ADD COLUMN "answerDirection"     "LearnAnswerDirection" NOT NULL DEFAULT 'TERM_TO_DEFINITION',
  ADD COLUMN "orderIndex"          INTEGER                NOT NULL DEFAULT 0,
  ADD COLUMN "selectedChoiceIndex" INTEGER,
  ADD COLUMN "similarity"          DECIMAL(4,3);

-- Drop the old Restrict FK and replace with Cascade — deleting an
-- attempt should carry its questions with it.
ALTER TABLE "test_question_attempt"
  DROP CONSTRAINT IF EXISTS "test_question_attempt_testAttemptId_fkey";
ALTER TABLE "test_question_attempt"
  ADD CONSTRAINT "test_question_attempt_testAttemptId_fkey"
    FOREIGN KEY ("testAttemptId") REFERENCES "test_attempt"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "test_question_attempt_testAttemptId_orderIndex_idx"
  ON "test_question_attempt" ("testAttemptId", "orderIndex");

-- 4) TestMatchingPair — one row per pair within a matching question.
CREATE TABLE "test_matching_pair" (
  "id"                     UUID    NOT NULL DEFAULT gen_random_uuid(),
  "testQuestionAttemptId"  UUID    NOT NULL,
  "flashcardId"            UUID    NOT NULL,
  "userMatchedFlashcardId" UUID,
  "isCorrect"              BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "test_matching_pair_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "test_matching_pair"
  ADD CONSTRAINT "test_matching_pair_testQuestionAttemptId_fkey"
    FOREIGN KEY ("testQuestionAttemptId") REFERENCES "test_question_attempt"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "test_matching_pair"
  ADD CONSTRAINT "test_matching_pair_flashcardId_fkey"
    FOREIGN KEY ("flashcardId") REFERENCES "flashcard"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "test_matching_pair"
  ADD CONSTRAINT "test_matching_pair_userMatchedFlashcardId_fkey"
    FOREIGN KEY ("userMatchedFlashcardId") REFERENCES "flashcard"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "test_matching_pair_testQuestionAttemptId_idx"
  ON "test_matching_pair" ("testQuestionAttemptId");

-- 5) Per-(user, set) Test Mode preferences.
CREATE TABLE "user_test_preferences" (
  "userId"                  UUID                   NOT NULL,
  "setId"                   UUID                   NOT NULL,
  "questionCount"           INTEGER                NOT NULL DEFAULT 20,
  "allowedTypes"            TEXT[]                 NOT NULL DEFAULT ARRAY['TEST_MC', 'TEST_WRITTEN', 'TEST_TF', 'TEST_MATCH']::TEXT[],
  "answerDirection"         "LearnAnswerDirection" NOT NULL DEFAULT 'TERM_TO_DEFINITION',
  "strictness"              "StudyStrictness"      NOT NULL DEFAULT 'NORMAL',
  "starredOnly"             BOOLEAN                NOT NULL DEFAULT false,
  "shuffleEnabled"          BOOLEAN                NOT NULL DEFAULT true,
  "showResultsPerQuestion"  BOOLEAN                NOT NULL DEFAULT false,
  "matchingPairCount"       INTEGER                NOT NULL DEFAULT 5,
  "createdAt"               TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_test_preferences_pkey" PRIMARY KEY ("userId", "setId")
);

ALTER TABLE "user_test_preferences"
  ADD CONSTRAINT "user_test_preferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_test_preferences"
  ADD CONSTRAINT "user_test_preferences_setId_fkey"
    FOREIGN KEY ("setId") REFERENCES "study_set"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
