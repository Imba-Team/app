import { StudyMode } from './card-attempt-event';

export const MASTERY_THRESHOLD = 3.0;
export const HINT_MULTIPLIER = 0.5;

export const MODE_WEIGHT: Record<StudyMode, number> = {
  FLASHCARD: 0.5,
  LEARN_MC: 0.5,
  LEARN_WRITTEN: 1.0,
  WRITE: 1.0,
  SPELL: 1.0,
  TEST_WRITTEN: 1.0,
  TEST_MC: 0.5,
  TEST_TF: 0.3,
  AI_FILL_BLANK: 1.0,
  AI_GUESS_WORD: 1.0,
  MATCH: 0,
};
