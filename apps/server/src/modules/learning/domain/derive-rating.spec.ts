import {
  RATING_FAST_RESPONSE_MS,
  RATING_SLOW_RESPONSE_MS,
  deriveRating,
} from './derive-rating';

describe('deriveRating — non-review outcomes', () => {
  it('returns null for SKIPPED', () => {
    expect(
      deriveRating({
        outcome: 'SKIPPED',
        hintUsed: false,
        studyMode: 'LEARN_MC',
      }),
    ).toBeNull();
  });

  it('returns null for plain FLASHCARD self-report', () => {
    expect(
      deriveRating({
        outcome: 'CORRECT',
        hintUsed: false,
        studyMode: 'FLASHCARD',
      }),
    ).toBeNull();
  });
});

describe('deriveRating — INCORRECT', () => {
  it('maps every INCORRECT to AGAIN', () => {
    expect(
      deriveRating({
        outcome: 'INCORRECT',
        hintUsed: false,
        studyMode: 'LEARN_WRITTEN',
      }),
    ).toBe('AGAIN');
    expect(
      deriveRating({
        outcome: 'INCORRECT',
        hintUsed: true,
        studyMode: 'LEARN_MC',
      }),
    ).toBe('AGAIN');
  });
});

describe('deriveRating — CORRECT with hint', () => {
  it('downgrades to HARD regardless of speed', () => {
    expect(
      deriveRating({
        outcome: 'CORRECT',
        hintUsed: true,
        studyMode: 'LEARN_MC',
        responseMs: 200,
      }),
    ).toBe('HARD');
  });
});

describe('deriveRating — CORRECT written', () => {
  it('similarity < 1 (typo accepted) → HARD', () => {
    expect(
      deriveRating({
        outcome: 'CORRECT',
        hintUsed: false,
        studyMode: 'LEARN_WRITTEN',
        similarity: 0.9,
      }),
    ).toBe('HARD');
  });

  it('exact similarity + fast → EASY', () => {
    expect(
      deriveRating({
        outcome: 'CORRECT',
        hintUsed: false,
        studyMode: 'LEARN_WRITTEN',
        similarity: 1,
        responseMs: RATING_FAST_RESPONSE_MS - 1,
      }),
    ).toBe('EASY');
  });

  it('exact similarity + normal speed → GOOD', () => {
    expect(
      deriveRating({
        outcome: 'CORRECT',
        hintUsed: false,
        studyMode: 'LEARN_WRITTEN',
        similarity: 1,
        responseMs: 6000,
      }),
    ).toBe('GOOD');
  });

  it('exact similarity + slow → HARD', () => {
    expect(
      deriveRating({
        outcome: 'CORRECT',
        hintUsed: false,
        studyMode: 'LEARN_WRITTEN',
        similarity: 1,
        responseMs: RATING_SLOW_RESPONSE_MS + 1,
      }),
    ).toBe('HARD');
  });
});

describe('deriveRating — CORRECT MC', () => {
  it('fast + no hint → EASY', () => {
    expect(
      deriveRating({
        outcome: 'CORRECT',
        hintUsed: false,
        studyMode: 'LEARN_MC',
        responseMs: 2000,
      }),
    ).toBe('EASY');
  });

  it('normal speed → GOOD', () => {
    expect(
      deriveRating({
        outcome: 'CORRECT',
        hintUsed: false,
        studyMode: 'LEARN_MC',
        responseMs: 8000,
      }),
    ).toBe('GOOD');
  });

  it('no responseMs defaults to GOOD when otherwise clean', () => {
    expect(
      deriveRating({
        outcome: 'CORRECT',
        hintUsed: false,
        studyMode: 'LEARN_MC',
      }),
    ).toBe('GOOD');
  });
});
