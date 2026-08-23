-- Drop MATCH from StudySessionMode enum. Postgres can't remove an enum
-- value in place, so we rename the type, create the replacement, migrate
-- dependent columns, and drop the old type.

ALTER TYPE "StudySessionMode" RENAME TO "StudySessionMode_old";

CREATE TYPE "StudySessionMode" AS ENUM (
  'FLASHCARD',
  'LEARN',
  'WRITE',
  'SPELL',
  'TEST',
  'AI_FILL_BLANK',
  'AI_GUESS_WORD'
);

ALTER TABLE "study_session"
  ALTER COLUMN "mode" TYPE "StudySessionMode"
  USING "mode"::text::"StudySessionMode";

ALTER TABLE "user_card_progress"
  ALTER COLUMN "lastStudyMode" TYPE "StudySessionMode"
  USING "lastStudyMode"::text::"StudySessionMode";

DROP TYPE "StudySessionMode_old";
