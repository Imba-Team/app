import { CardAttemptEvent } from './card-attempt-event';
import {
  HINT_MULTIPLIER,
  MASTERY_THRESHOLD,
  MODE_WEIGHT,
} from './mode-weights';

export type MasteryStatus = 'NEW' | 'LEARNING' | 'MASTERED';

export interface ProgressState {
  status: MasteryStatus;
  weightedStreak: number;
  correctCount: number;
  incorrectCount: number;
  hintsUsedCount: number;
  timesDemoted: number;
  masteredAt: Date | null;
}

export interface ApplyResult {
  next: ProgressState;
  graduated: boolean;
  demoted: boolean;
}

export function applyAttempt(
  prev: ProgressState,
  event: CardAttemptEvent,
  now: Date = new Date(),
): ApplyResult {
  if (event.outcome === 'SKIPPED') {
    return { next: prev, graduated: false, demoted: false };
  }

  if (event.outcome === 'INCORRECT') {
    const demoted = prev.status === 'MASTERED';
    return {
      next: {
        ...prev,
        status: 'LEARNING',
        weightedStreak: 0,
        incorrectCount: prev.incorrectCount + 1,
        timesDemoted: demoted ? prev.timesDemoted + 1 : prev.timesDemoted,
      },
      graduated: false,
      demoted,
    };
  }

  const base = MODE_WEIGHT[event.studyMode] ?? 0;
  if (base === 0) {
    return { next: prev, graduated: false, demoted: false };
  }

  const credit = event.hintUsed ? base * HINT_MULTIPLIER : base;
  const newStreak = prev.weightedStreak + credit;
  const reachedMastery = newStreak >= MASTERY_THRESHOLD;
  const graduated = reachedMastery && prev.status !== 'MASTERED';
  const nextStatus: MasteryStatus = reachedMastery ? 'MASTERED' : 'LEARNING';

  return {
    next: {
      ...prev,
      status: nextStatus,
      weightedStreak: newStreak,
      correctCount: prev.correctCount + 1,
      hintsUsedCount: prev.hintsUsedCount + (event.hintUsed ? 1 : 0),
      masteredAt: graduated ? now : prev.masteredAt,
    },
    graduated,
    demoted: false,
  };
}

export const NEW_PROGRESS: ProgressState = {
  status: 'NEW',
  weightedStreak: 0,
  correctCount: 0,
  incorrectCount: 0,
  hintsUsedCount: 0,
  timesDemoted: 0,
  masteredAt: null,
};
