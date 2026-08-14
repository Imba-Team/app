-- 1) Study strictness + answer-direction enums
CREATE TYPE "StudyStrictness" AS ENUM ('STRICT', 'NORMAL', 'LENIENT');
CREATE TYPE "LearnAnswerDirection" AS ENUM (
  'TERM_TO_DEFINITION',
  'DEFINITION_TO_TERM'
);

-- 2) Extend user_set_preferences with the new per-set toggles.
ALTER TABLE "user_set_preferences"
  ADD COLUMN "starredOnly"     BOOLEAN                NOT NULL DEFAULT false,
  ADD COLUMN "shuffleEnabled"  BOOLEAN                NOT NULL DEFAULT true,
  ADD COLUMN "strictness"      "StudyStrictness"      NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "answerDirection" "LearnAnswerDirection" NOT NULL DEFAULT 'TERM_TO_DEFINITION';
