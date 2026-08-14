-- 1) New enum value for the answer-direction preference. MIXED means
-- "roll a direction per card at batch time" — batch cards on the wire
-- are still TERM_TO_DEFINITION or DEFINITION_TO_TERM.
ALTER TYPE "LearnAnswerDirection" ADD VALUE 'MIXED';

-- 2) Sound-effects toggle on user_set_preferences. Placeholder like
-- audioEnabled — the toggle persists but no player is wired yet.
ALTER TABLE "user_set_preferences"
  ADD COLUMN "soundEffectsEnabled" BOOLEAN NOT NULL DEFAULT false;
