/**
 * Card mastery scoring — mirrors the backend Card Mastery Progress Engine
 * defined in Mimir_TDD_v1.md §8a.
 *
 * The backend is the source of truth. This client-side implementation is used to
 * optimistically update the UI while the network round-trip is in flight.
 * If the two disagree (e.g. due to server-side leech detection), the server wins.
 *
 * Rules encoded here (v1 — refine when §8a evolves):
 *   NEW -> LEARNING            on first correct answer
 *   LEARNING -> MASTERED       when weightedStreak >= 4.0
 *   any -> LEARNING (demote)   on incorrect answer if MASTERED
 *   weightedStreak resets to 0 on any incorrect answer.
 *   Hints reduce the weight of a correct answer by half.
 */

export type CardMasteryStatus = 'NEW' | 'LEARNING' | 'MASTERED';

export interface CardProgress {
  status: CardMasteryStatus;
  weightedStreak: number;
  correctCount: number;
  incorrectCount: number;
  hintsUsedCount: number;
  timesDemoted: number;
  masteredAt: string | null;
}

export const initialProgress = (): CardProgress => ({
  status: 'NEW',
  weightedStreak: 0,
  correctCount: 0,
  incorrectCount: 0,
  hintsUsedCount: 0,
  timesDemoted: 0,
  masteredAt: null,
});

export interface AnswerEvent {
  correct: boolean;
  usedHint: boolean;
  /** ISO timestamp — used to seal `masteredAt` on the first MASTERED transition. */
  at: string;
}

const MASTERY_THRESHOLD = 4.0;
const CORRECT_WEIGHT = 1.0;
const CORRECT_WITH_HINT_WEIGHT = 0.5;

export function reduceProgress(prev: CardProgress, event: AnswerEvent): CardProgress {
  if (!event.correct) {
    const demoting = prev.status === 'MASTERED';
    return {
      status: prev.status === 'NEW' ? 'NEW' : 'LEARNING',
      weightedStreak: 0,
      correctCount: prev.correctCount,
      incorrectCount: prev.incorrectCount + 1,
      hintsUsedCount: prev.hintsUsedCount + (event.usedHint ? 1 : 0),
      timesDemoted: prev.timesDemoted + (demoting ? 1 : 0),
      masteredAt: prev.masteredAt,
    };
  }

  const weight = event.usedHint ? CORRECT_WITH_HINT_WEIGHT : CORRECT_WEIGHT;
  const nextStreak = prev.weightedStreak + weight;
  const willMaster = prev.status !== 'MASTERED' && nextStreak >= MASTERY_THRESHOLD;

  return {
    status: willMaster ? 'MASTERED' : prev.status === 'NEW' ? 'LEARNING' : prev.status,
    weightedStreak: nextStreak,
    correctCount: prev.correctCount + 1,
    incorrectCount: prev.incorrectCount,
    hintsUsedCount: prev.hintsUsedCount + (event.usedHint ? 1 : 0),
    timesDemoted: prev.timesDemoted,
    masteredAt: prev.masteredAt ?? (willMaster ? event.at : null),
  };
}
