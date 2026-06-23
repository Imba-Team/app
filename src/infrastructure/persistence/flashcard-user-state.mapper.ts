import type { FlashcardUserState } from '@prisma/client';

export type FlashcardProgressStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed';

export function confidenceToStatus(
  state: FlashcardUserState | null | undefined,
): FlashcardProgressStatus {
  if (!state) return 'not_started';
  const cl = state.confidenceLevel;
  if (cl >= 0.999) return 'completed';
  if (cl > 0 || state.lastReviewedAt != null) return 'in_progress';
  return 'not_started';
}

export function statusToConfidence(status: FlashcardProgressStatus): number {
  switch (status) {
    case 'completed':
      return 1;
    case 'in_progress':
      return 0.5;
    default:
      return 0;
  }
}

export function nextStatusAfterAnswer(
  current: FlashcardProgressStatus,
  success: boolean,
): FlashcardProgressStatus {
  if (success) {
    if (current === 'not_started') return 'in_progress';
    if (current === 'in_progress') return 'completed';
    return 'completed';
  }
  if (current === 'completed') return 'in_progress';
  if (current === 'in_progress') return 'not_started';
  return 'not_started';
}
