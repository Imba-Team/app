import {
  NEW_SRS_CARD,
  SM2_LEECH_LAPSE_THRESHOLD,
  SM2_MIN_EASE,
  Sm2Rating,
  Sm2ReviewInput,
  processReview,
} from './sm2';

function card(overrides: Partial<Sm2ReviewInput> = {}): Sm2ReviewInput {
  return { ...NEW_SRS_CARD, ...overrides };
}

describe('processReview', () => {
  describe('AGAIN — completely forgot', () => {
    it('resets interval to 1, increments lapses, reduces ease by 0.20', () => {
      const result = processReview(
        card({ repetitions: 3, intervalDays: 10, easeFactor: 2.5 }),
        'AGAIN',
      );
      expect(result.intervalDays).toBe(1);
      expect(result.repetitions).toBe(0);
      expect(result.lapses).toBe(1);
      expect(result.easeFactor).toBeCloseTo(2.3, 5);
    });

    it('resets repetitions to 0 even on a mature card', () => {
      const result = processReview(
        card({ repetitions: 15, intervalDays: 90, easeFactor: 2.8 }),
        'AGAIN',
      );
      expect(result.repetitions).toBe(0);
    });

    it('respects ease floor of 1.3 when reducing ease', () => {
      const result = processReview(card({ easeFactor: 1.4 }), 'AGAIN');
      expect(result.easeFactor).toBeCloseTo(SM2_MIN_EASE, 5);
    });

    it('increments lapses on every AGAIN', () => {
      const result = processReview(card({ lapses: 5 }), 'AGAIN');
      expect(result.lapses).toBe(6);
    });
  });

  describe('First-review intervals (repetitions 0 → 1 → 2)', () => {
    it('GOOD on a new card (repetitions=0) sets intervalDays to 1', () => {
      const result = processReview(card({ repetitions: 0 }), 'GOOD');
      expect(result.intervalDays).toBe(1);
      expect(result.repetitions).toBe(1);
    });

    it('GOOD after first review (repetitions=1) sets intervalDays to 6', () => {
      const result = processReview(
        card({ repetitions: 1, intervalDays: 1 }),
        'GOOD',
      );
      expect(result.intervalDays).toBe(6);
      expect(result.repetitions).toBe(2);
    });

    it('HARD after first review still uses the fixed 6-day interval (rep 0/1 dominates rating)', () => {
      const result = processReview(
        card({ repetitions: 1, intervalDays: 1 }),
        'HARD',
      );
      expect(result.intervalDays).toBe(6);
    });
  });

  describe('GOOD on mature cards (standard SM-2)', () => {
    it('third GOOD review multiplies interval by ease factor', () => {
      const result = processReview(
        card({ repetitions: 2, intervalDays: 6, easeFactor: 2.5 }),
        'GOOD',
      );
      expect(result.intervalDays).toBe(15);
      expect(result.easeFactor).toBe(2.5);
      expect(result.repetitions).toBe(3);
    });

    it('does not change easeFactor', () => {
      const result = processReview(
        card({ repetitions: 4, intervalDays: 15, easeFactor: 2.3 }),
        'GOOD',
      );
      expect(result.easeFactor).toBe(2.3);
    });
  });

  describe('HARD on mature cards', () => {
    it('interval × 0.80, ease − 0.15', () => {
      const result = processReview(
        card({ repetitions: 3, intervalDays: 10, easeFactor: 2.5 }),
        'HARD',
      );
      expect(result.intervalDays).toBe(8);
      expect(result.easeFactor).toBeCloseTo(2.35, 5);
    });

    it('ease floor 1.3 applies to HARD', () => {
      const result = processReview(
        card({ repetitions: 3, intervalDays: 5, easeFactor: 1.31 }),
        'HARD',
      );
      expect(result.easeFactor).toBeCloseTo(SM2_MIN_EASE, 5);
    });

    it('interval never rounds below 1', () => {
      const result = processReview(
        card({ repetitions: 3, intervalDays: 1, easeFactor: 2.5 }),
        'HARD',
      );
      expect(result.intervalDays).toBeGreaterThanOrEqual(1);
    });
  });

  describe('EASY on mature cards', () => {
    it('interval × ease × 1.30, ease + 0.10', () => {
      const result = processReview(
        card({ repetitions: 3, intervalDays: 10, easeFactor: 2.5 }),
        'EASY',
      );
      expect(result.intervalDays).toBe(33);
      expect(result.easeFactor).toBeCloseTo(2.6, 5);
    });

    it('lets ease rise above the initial 2.5 default', () => {
      const result = processReview(
        card({ repetitions: 5, intervalDays: 30, easeFactor: 2.5 }),
        'EASY',
      );
      expect(result.easeFactor).toBeGreaterThan(2.5);
    });
  });

  describe('Leech detection (lapses ≥ 7)', () => {
    it('flags isLeech=true on the 7th AGAIN', () => {
      const result = processReview(card({ lapses: 6 }), 'AGAIN');
      expect(result.lapses).toBe(7);
      expect(result.isLeech).toBe(true);
    });

    it('does not flag isLeech at 6 lapses', () => {
      const result = processReview(card({ lapses: 5 }), 'AGAIN');
      expect(result.lapses).toBe(6);
      expect(result.isLeech).toBe(false);
    });

    it('leech stays true once triggered (subsequent AGAINs keep the flag)', () => {
      const result = processReview(card({ lapses: 7 }), 'AGAIN');
      expect(result.isLeech).toBe(true);
    });

    it('reports isLeech based on lapses even on a GOOD review', () => {
      const result = processReview(
        card({ repetitions: 3, intervalDays: 10, lapses: 7 }),
        'GOOD',
      );
      expect(result.isLeech).toBe(true);
    });
  });

  describe('lapses counter behavior', () => {
    it('does not increment lapses on GOOD/HARD/EASY', () => {
      for (const rating of ['GOOD', 'HARD', 'EASY'] as Sm2Rating[]) {
        const result = processReview(
          card({ repetitions: 3, intervalDays: 10, lapses: 2 }),
          rating,
        );
        expect(result.lapses).toBe(2);
      }
    });
  });

  describe('repetitions counter behavior', () => {
    it('increments repetitions on GOOD/HARD/EASY', () => {
      for (const rating of ['GOOD', 'HARD', 'EASY'] as Sm2Rating[]) {
        const result = processReview(
          card({ repetitions: 3, intervalDays: 10 }),
          rating,
        );
        expect(result.repetitions).toBe(4);
      }
    });

    it('resets repetitions to 0 on AGAIN', () => {
      const result = processReview(card({ repetitions: 10 }), 'AGAIN');
      expect(result.repetitions).toBe(0);
    });
  });

  describe('interval-growth simulation (Sprint 7 DoD requirement)', () => {
    it('10 consecutive GOOD reviews grow the interval monotonically', () => {
      let state = card();
      let previousInterval = 0;
      for (let day = 0; day < 10; day += 1) {
        state = { ...state, ...processReview(state, 'GOOD') };
        expect(state.intervalDays).toBeGreaterThanOrEqual(previousInterval);
        previousInterval = state.intervalDays;
      }
      expect(state.repetitions).toBe(10);
      // After 10 GOOD reviews from a new card: intervals should grow
      // dramatically past the 6-day second-review anchor.
      expect(state.intervalDays).toBeGreaterThan(1000);
    });

    it('a Hard interrupt in a long GOOD streak shrinks the interval', () => {
      let state = card();
      for (let day = 0; day < 4; day += 1) {
        state = { ...state, ...processReview(state, 'GOOD') };
      }
      const beforeHard = state.intervalDays;
      state = { ...state, ...processReview(state, 'HARD') };
      expect(state.intervalDays).toBeLessThan(beforeHard);
    });

    it('an AGAIN after a long streak resets the schedule to day 1', () => {
      let state = card();
      for (let day = 0; day < 6; day += 1) {
        state = { ...state, ...processReview(state, 'GOOD') };
      }
      expect(state.repetitions).toBeGreaterThan(1);
      state = { ...state, ...processReview(state, 'AGAIN') };
      expect(state.intervalDays).toBe(1);
      expect(state.repetitions).toBe(0);
      expect(state.lapses).toBe(1);
    });
  });

  describe('constants match TDD §8 and roadmap Sprint 7 spec', () => {
    it('MIN_EASE = 1.3', () => {
      expect(SM2_MIN_EASE).toBe(1.3);
    });

    it('LEECH threshold = 7 lapses', () => {
      expect(SM2_LEECH_LAPSE_THRESHOLD).toBe(7);
    });
  });
});
