export type Sm2Rating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

export interface Sm2ReviewInput {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface Sm2ReviewOutput {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  isLeech: boolean;
}

export const SM2_MIN_EASE = 1.3;
export const SM2_LEECH_LAPSE_THRESHOLD = 7;
export const SM2_FIRST_INTERVAL_DAYS = 1;
export const SM2_SECOND_INTERVAL_DAYS = 6;
export const SM2_HARD_INTERVAL_FACTOR = 0.8;
export const SM2_EASY_INTERVAL_FACTOR = 1.3;
export const SM2_AGAIN_EASE_DELTA = -0.2;
export const SM2_HARD_EASE_DELTA = -0.15;
export const SM2_EASY_EASE_DELTA = 0.1;

export function processReview(
  card: Sm2ReviewInput,
  rating: Sm2Rating,
): Sm2ReviewOutput {
  const prevEase = card.easeFactor;

  if (rating === 'AGAIN') {
    const lapses = card.lapses + 1;
    return {
      easeFactor: Math.max(SM2_MIN_EASE, prevEase + SM2_AGAIN_EASE_DELTA),
      intervalDays: SM2_FIRST_INTERVAL_DAYS,
      repetitions: 0,
      lapses,
      isLeech: lapses >= SM2_LEECH_LAPSE_THRESHOLD,
    };
  }

  let intervalDays: number;
  if (card.repetitions === 0) {
    intervalDays = SM2_FIRST_INTERVAL_DAYS;
  } else if (card.repetitions === 1) {
    intervalDays = SM2_SECOND_INTERVAL_DAYS;
  } else if (rating === 'HARD') {
    intervalDays = Math.max(
      1,
      Math.round(card.intervalDays * SM2_HARD_INTERVAL_FACTOR),
    );
  } else if (rating === 'GOOD') {
    intervalDays = Math.max(1, Math.round(card.intervalDays * prevEase));
  } else {
    intervalDays = Math.max(
      1,
      Math.round(card.intervalDays * prevEase * SM2_EASY_INTERVAL_FACTOR),
    );
  }

  let easeFactor = prevEase;
  if (rating === 'HARD') {
    easeFactor = Math.max(SM2_MIN_EASE, prevEase + SM2_HARD_EASE_DELTA);
  } else if (rating === 'EASY') {
    easeFactor = prevEase + SM2_EASY_EASE_DELTA;
  }

  return {
    easeFactor,
    intervalDays,
    repetitions: card.repetitions + 1,
    lapses: card.lapses,
    isLeech: card.lapses >= SM2_LEECH_LAPSE_THRESHOLD,
  };
}

export const NEW_SRS_CARD: Sm2ReviewInput = {
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
  lapses: 0,
};
