import { LearnPromptType } from '../dtos/learn-batch-response.dto';
import { AttemptOutcome, StudyMode } from './card-attempt-event';

/**
 * A single row from CardAttempt trimmed down to the fields the prompt
 * selector actually reads. Kept as a structural type so callers can
 * project directly out of prisma without adapting shapes.
 */
export interface RecentAttempt {
  studyMode: StudyMode | string;
  outcome: AttemptOutcome;
  hintUsed: boolean;
  createdAt: Date;
}

export interface SelectPromptTypeInput {
  /** Weighted streak from UserCardProgress. */
  streak: number;
  /**
   * Threshold at which the batch algorithm switches from LEARN_MC to
   * LEARN_WRITTEN by streak alone. Derived from `mcWrittenBias` in
   * the caller.
   */
  writtenThreshold: number;
  /** Distractor pool size — we can only render MC when we have ≥ 3. */
  distractorPoolSize: number;
  /**
   * Most recent CardAttempt rows for this card, newest-first. Only
   * the last few matter — the selector reads at most `attempts[0..2]`.
   */
  recentAttempts: RecentAttempt[];
  now?: Date;
}

/**
 * Threshold for the "recently attempted correctly" escalation. If a
 * learner just got the same card right on a MC prompt in the last
 * couple of minutes, we escalate to LEARN_WRITTEN even if the streak
 * hasn't crossed the base threshold — the recall signal is fresh and
 * the harder prompt exercises real retrieval, not just recognition.
 */
export const RECENT_CORRECT_WINDOW_MS = 2 * 60 * 1000;

/**
 * Threshold for the "recently struggling" de-escalation. If the
 * learner has missed this card twice in the last three attempts,
 * demote to LEARN_MC even when the streak (which resets to 0 on a
 * miss) would otherwise land them on LEARN_WRITTEN — recognition
 * gives them a lower-stakes win before we push recall again.
 */
const RECENT_ATTEMPTS_WINDOW = 3;
const RECENT_MISSES_TO_DEMOTE = 2;

/**
 * Choose LEARN_MC vs LEARN_WRITTEN for a single card. Baseline is the
 * streak-vs-threshold check, overridden by two per-card signals from
 * the recent CardAttempt log:
 *
 *  - Recent struggling → force LEARN_MC (compassion path).
 *  - Recent correct via MC → escalate to LEARN_WRITTEN (challenge path).
 *
 * When MC is unrenderable (distractor pool < 3), always fall back to
 * LEARN_WRITTEN — the compassion path can't override that.
 */
export function selectPromptType(
  input: SelectPromptTypeInput,
): LearnPromptType {
  const canRenderMC = input.distractorPoolSize >= 3;
  if (!canRenderMC) return 'LEARN_WRITTEN';

  const recent = input.recentAttempts.slice(0, RECENT_ATTEMPTS_WINDOW);
  const misses = recent.filter((a) => a.outcome === 'INCORRECT').length;
  if (misses >= RECENT_MISSES_TO_DEMOTE) {
    return 'LEARN_MC';
  }

  const now = input.now ?? new Date();
  const last = input.recentAttempts[0];
  if (
    last &&
    last.outcome === 'CORRECT' &&
    !last.hintUsed &&
    last.studyMode === 'LEARN_MC' &&
    now.getTime() - last.createdAt.getTime() < RECENT_CORRECT_WINDOW_MS
  ) {
    return 'LEARN_WRITTEN';
  }

  return input.streak < input.writtenThreshold ? 'LEARN_MC' : 'LEARN_WRITTEN';
}
