import { Sm2Rating } from 'src/modules/srs/domain/sm2';

import { AttemptOutcome, StudyMode } from './card-attempt-event';

export interface DeriveRatingInput {
  outcome: AttemptOutcome;
  hintUsed: boolean;
  studyMode: StudyMode;
  /** Written-mode similarity (0.0–1.0). Undefined for MC/self-report. */
  similarity?: number;
  /** Client-measured milliseconds from card render to submit. */
  responseMs?: number;
}

/**
 * Cutoffs. Kept as module-level constants so callers reading the
 * numbers back (tests, tuning notes) can see them in one place.
 *
 * Slow / fast are milliseconds. The slow cutoff is set generously so
 * we don't downgrade every learner who took a moment to think; only
 * genuinely laboured answers count as HARD. The fast cutoff is tight
 * enough that a lucky-click on the first choice doesn't count as EASY.
 */
export const RATING_SLOW_RESPONSE_MS = 15_000;
export const RATING_FAST_RESPONSE_MS = 3_500;

/**
 * Map a per-attempt event to an SM-2 rating. Returns `null` when the
 * attempt should NOT be forwarded to SRS — SKIPPED answers, and modes
 * with zero mastery weight (e.g. MATCH) don't count as reviews.
 *
 * The mapping is intentionally coarse:
 *  - INCORRECT → AGAIN (SM-2 reset).
 *  - CORRECT with a hint, a written near-miss, or a slow response → HARD.
 *  - CORRECT and fast → EASY.
 *  - Everything else → GOOD.
 *
 * We deliberately downgrade laboured answers rather than treating any
 * CORRECT as GOOD by default: the whole point of SRS is that "correct
 * but struggling" schedules a shorter interval than "correct and
 * confident".
 */
export function deriveRating(input: DeriveRatingInput): Sm2Rating | null {
  if (input.outcome === 'SKIPPED') return null;
  // Non-scoring modes (MATCH has weight 0) shouldn't ping SRS either —
  // the game modes don't produce a real recall signal.
  if (input.studyMode === 'MATCH' || input.studyMode === 'FLASHCARD') {
    return null;
  }

  if (input.outcome === 'INCORRECT') return 'AGAIN';

  // CORRECT from here on.
  if (input.hintUsed) return 'HARD';

  // Written mode near-miss: TYPO_ACCEPTED still scores CORRECT but
  // similarity < 1.0. Treat as HARD so the interval grows more slowly.
  if (input.similarity !== undefined && input.similarity < 1.0) {
    return 'HARD';
  }

  // Response-time signal, when the client provided one. Slow first,
  // fast second — the two are mutually exclusive.
  if (input.responseMs !== undefined) {
    if (input.responseMs > RATING_SLOW_RESPONSE_MS) return 'HARD';
    if (input.responseMs < RATING_FAST_RESPONSE_MS) return 'EASY';
  }

  return 'GOOD';
}
