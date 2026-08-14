-- 1) Study session lifecycle enum
CREATE TYPE "StudySessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ABANDONED', 'COMPLETED');

-- 2) Extend study_session with status, resumeState (JSON blob), and
-- lastActivityAt (drives the abandoned-session sweep instead of
-- startedAt so long, active sessions aren't swept mid-flow).
ALTER TABLE "study_session"
  ADD COLUMN "status"         "StudySessionStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "resumeState"    JSONB,
  ADD COLUMN "lastActivityAt" TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: any existing completed session should carry the COMPLETED
-- status. Uncompleted rows stay ACTIVE (the default).
UPDATE "study_session"
SET "status" = 'COMPLETED'
WHERE "completedAt" IS NOT NULL;

CREATE INDEX "study_session_userId_studySetId_mode_status_idx"
  ON "study_session" ("userId", "studySetId", "mode", "status");

-- 3) Per-(user, set) study preferences.
CREATE TABLE "user_set_preferences" (
  "userId"           UUID         NOT NULL,
  "setId"            UUID         NOT NULL,
  "batchSize"        INTEGER      NOT NULL DEFAULT 10,
  "mcWrittenBias"    DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  "masteryThreshold" DECIMAL(4,2) NOT NULL DEFAULT 3.00,
  "hintMultiplier"   DECIMAL(3,2) NOT NULL DEFAULT 0.50,
  "autoAdvance"      BOOLEAN      NOT NULL DEFAULT true,
  "autoAdvanceMs"    INTEGER      NOT NULL DEFAULT 1400,
  "audioEnabled"     BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_set_preferences_pkey" PRIMARY KEY ("userId", "setId")
);

ALTER TABLE "user_set_preferences"
  ADD CONSTRAINT "user_set_preferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_set_preferences"
  ADD CONSTRAINT "user_set_preferences_setId_fkey"
  FOREIGN KEY ("setId") REFERENCES "study_set"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
