import { StudyMode } from './card-attempt-event';

/**
 * Module-level defaults. These are the values a card is scored against
 * when a learner has no per-set preferences saved — the preferences
 * loader in learning.service.ts falls back to these on cache miss.
 *
 * Tuned so that a single LEARN_WRITTEN correct answer takes a card
 * from 0 → 1.0 (a third of the way to mastery), and three consecutive
 * LEARN_WRITTEN correct answers graduate it. LEARN_MC is worth half
 * because recognition is easier than recall.
 */
export const DEFAULT_MASTERY_THRESHOLD = 3.0;
export const DEFAULT_HINT_MULTIPLIER = 0.5;

/**
 * Legacy aliases retained for the domain unit tests and any code that
 * still imports the module-level constants directly. New call sites
 * should thread `MasteryConfig` from the caller instead.
 */
export const MASTERY_THRESHOLD = DEFAULT_MASTERY_THRESHOLD;
export const HINT_MULTIPLIER = DEFAULT_HINT_MULTIPLIER;

/**
 * Fixed per-mode credit weights. Not exposed as a preference — the
 * ratios encode learning-science assumptions (recall > recognition)
 * that don't need to be tunable per set.
 */
export const MODE_WEIGHT: Record<StudyMode, number> = {
  FLASHCARD: 0.5,
  LEARN_MC: 0.5,
  LEARN_WRITTEN: 1.0,
  WRITE: 1.0,
  SPELL: 1.0,
  TEST_WRITTEN: 1.0,
  TEST_MC: 0.5,
  TEST_TF: 0.3,
  // Matching pairs read like MC (recognition, pick from a shuffled
  // set of candidates), so their weight mirrors TEST_MC.
  TEST_MATCH: 0.5,
  AI_FILL_BLANK: 1.0,
  AI_GUESS_WORD: 1.0,
};

export interface MasteryConfig {
  masteryThreshold: number;
  hintMultiplier: number;
}

export const DEFAULT_MASTERY_CONFIG: MasteryConfig = {
  masteryThreshold: DEFAULT_MASTERY_THRESHOLD,
  hintMultiplier: DEFAULT_HINT_MULTIPLIER,
};
