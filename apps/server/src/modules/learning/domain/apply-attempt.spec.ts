import { CardAttemptEvent, StudyMode } from './card-attempt-event';
import {
  ApplyResult,
  NEW_PROGRESS,
  ProgressState,
  applyAttempt,
} from './apply-attempt';
import { MASTERY_THRESHOLD } from './mode-weights';

const FIXED_NOW = new Date('2026-07-01T15:00:00Z');

function event(overrides: Partial<CardAttemptEvent> = {}): CardAttemptEvent {
  return {
    attemptId: 'attempt-1',
    userId: 'user-1',
    cardId: 'card-1',
    setId: 'set-1',
    sessionId: 'session-1',
    studyMode: 'WRITE',
    outcome: 'CORRECT',
    hintUsed: false,
    attemptedAt: FIXED_NOW,
    ...overrides,
  };
}

function state(overrides: Partial<ProgressState> = {}): ProgressState {
  return { ...NEW_PROGRESS, ...overrides };
}

describe('applyAttempt', () => {
  describe('SKIPPED', () => {
    it('is a no-op — returns state unchanged, no graduation, no demotion', () => {
      const prev = state({ status: 'LEARNING', weightedStreak: 2.0 });
      const result = applyAttempt(
        prev,
        event({ outcome: 'SKIPPED' }),
        FIXED_NOW,
      );
      expect(result).toEqual<ApplyResult>({
        next: prev,
        graduated: false,
        demoted: false,
      });
    });
  });

  describe('INCORRECT', () => {
    it('resets streak, moves to LEARNING, increments incorrectCount', () => {
      const prev = state({
        status: 'LEARNING',
        weightedStreak: 1.5,
        incorrectCount: 2,
      });
      const { next, graduated, demoted } = applyAttempt(
        prev,
        event({ outcome: 'INCORRECT' }),
        FIXED_NOW,
      );
      expect(next.status).toBe('LEARNING');
      expect(next.weightedStreak).toBe(0);
      expect(next.incorrectCount).toBe(3);
      expect(next.timesDemoted).toBe(0);
      expect(graduated).toBe(false);
      expect(demoted).toBe(false);
    });

    it('demotes MASTERED → LEARNING and increments timesDemoted, sets demoted flag', () => {
      const prev = state({
        status: 'MASTERED',
        weightedStreak: 4.0,
        timesDemoted: 1,
        masteredAt: FIXED_NOW,
      });
      const { next, demoted, graduated } = applyAttempt(
        prev,
        event({ outcome: 'INCORRECT' }),
        FIXED_NOW,
      );
      expect(next.status).toBe('LEARNING');
      expect(next.weightedStreak).toBe(0);
      expect(next.timesDemoted).toBe(2);
      expect(next.masteredAt).toEqual(FIXED_NOW);
      expect(demoted).toBe(true);
      expect(graduated).toBe(false);
    });

    it('does not increment timesDemoted when previously LEARNING', () => {
      const prev = state({ status: 'LEARNING', timesDemoted: 3 });
      const { next } = applyAttempt(
        prev,
        event({ outcome: 'INCORRECT' }),
        FIXED_NOW,
      );
      expect(next.timesDemoted).toBe(3);
    });

    it('does not increment timesDemoted when previously NEW', () => {
      const prev = state({ status: 'NEW', timesDemoted: 0 });
      const { next, demoted } = applyAttempt(
        prev,
        event({ outcome: 'INCORRECT' }),
        FIXED_NOW,
      );
      expect(next.timesDemoted).toBe(0);
      expect(demoted).toBe(false);
    });
  });

  describe('CORRECT — weight lookup', () => {
    const weightCases: Array<[StudyMode, number]> = [
      ['FLASHCARD', 0.5],
      ['LEARN_MC', 0.5],
      ['LEARN_WRITTEN', 1.0],
      ['WRITE', 1.0],
      ['SPELL', 1.0],
      ['TEST_WRITTEN', 1.0],
      ['TEST_MC', 0.5],
      ['TEST_TF', 0.3],
      ['AI_FILL_BLANK', 1.0],
      ['AI_GUESS_WORD', 1.0],
    ];

    test.each(weightCases)('%s awards weight %s', (studyMode, weight) => {
      const { next } = applyAttempt(
        NEW_PROGRESS,
        event({ studyMode }),
        FIXED_NOW,
      );
      expect(next.weightedStreak).toBeCloseTo(weight, 5);
      expect(next.correctCount).toBe(1);
    });
  });

  describe('CORRECT — hint multiplier', () => {
    it('halves recall weight when hint used (1.0 → 0.5)', () => {
      const { next } = applyAttempt(
        NEW_PROGRESS,
        event({ studyMode: 'WRITE', hintUsed: true }),
        FIXED_NOW,
      );
      expect(next.weightedStreak).toBeCloseTo(0.5, 5);
      expect(next.hintsUsedCount).toBe(1);
    });

    it('halves recognition weight when hint used (0.5 → 0.25)', () => {
      const { next } = applyAttempt(
        NEW_PROGRESS,
        event({ studyMode: 'LEARN_MC', hintUsed: true }),
        FIXED_NOW,
      );
      expect(next.weightedStreak).toBeCloseTo(0.25, 5);
      expect(next.hintsUsedCount).toBe(1);
    });

    it('halves T/F weight when hint used (0.3 → 0.15)', () => {
      const { next } = applyAttempt(
        NEW_PROGRESS,
        event({ studyMode: 'TEST_TF', hintUsed: true }),
        FIXED_NOW,
      );
      expect(next.weightedStreak).toBeCloseTo(0.15, 5);
    });

    it('does not increment hintsUsedCount when hint not used', () => {
      const { next } = applyAttempt(
        NEW_PROGRESS,
        event({ hintUsed: false }),
        FIXED_NOW,
      );
      expect(next.hintsUsedCount).toBe(0);
    });
  });

  describe('mastery threshold boundary', () => {
    it('stays LEARNING when streak is just below threshold', () => {
      const prev = state({
        status: 'LEARNING',
        weightedStreak: MASTERY_THRESHOLD - 0.5,
      });
      const { next, graduated } = applyAttempt(
        prev,
        event({ studyMode: 'LEARN_MC' }), // +0.5 exactly hits threshold
        FIXED_NOW,
      );
      expect(next.status).toBe('MASTERED');
      expect(graduated).toBe(true);
      expect(next.masteredAt).toEqual(FIXED_NOW);
    });

    it('promotes to MASTERED when streak >= threshold exactly on boundary', () => {
      const prev = state({ status: 'LEARNING', weightedStreak: 2.0 });
      const { next, graduated } = applyAttempt(
        prev,
        event({ studyMode: 'WRITE' }), // +1.0 → 3.0 exactly
        FIXED_NOW,
      );
      expect(next.weightedStreak).toBeCloseTo(3.0, 5);
      expect(next.status).toBe('MASTERED');
      expect(graduated).toBe(true);
    });

    it('does not re-graduate when already MASTERED — preserves original masteredAt', () => {
      const originalMasteredAt = new Date('2026-01-01T00:00:00Z');
      const prev = state({
        status: 'MASTERED',
        weightedStreak: 3.5,
        masteredAt: originalMasteredAt,
      });
      const { next, graduated } = applyAttempt(
        prev,
        event({ studyMode: 'WRITE' }),
        FIXED_NOW,
      );
      expect(next.status).toBe('MASTERED');
      expect(next.masteredAt).toEqual(originalMasteredAt);
      expect(graduated).toBe(false);
    });

    it('stays LEARNING when streak is below threshold', () => {
      const prev = state({ status: 'NEW', weightedStreak: 0 });
      const { next, graduated } = applyAttempt(
        prev,
        event({ studyMode: 'LEARN_MC' }), // +0.5 → 0.5
        FIXED_NOW,
      );
      expect(next.status).toBe('LEARNING');
      expect(graduated).toBe(false);
      expect(next.masteredAt).toBeNull();
    });
  });

  describe('typical journey', () => {
    it('three consecutive WRITE-correct answers graduate NEW → MASTERED', () => {
      let s = NEW_PROGRESS;
      let last!: ApplyResult;
      for (let i = 0; i < 3; i += 1) {
        last = applyAttempt(s, event({ studyMode: 'WRITE' }), FIXED_NOW);
        s = last.next;
      }
      expect(s.status).toBe('MASTERED');
      expect(s.weightedStreak).toBeCloseTo(3.0, 5);
      expect(s.correctCount).toBe(3);
      expect(last.graduated).toBe(true);
    });

    it('six consecutive LEARN_MC-correct answers graduate NEW → MASTERED', () => {
      let s = NEW_PROGRESS;
      for (let i = 0; i < 6; i += 1) {
        s = applyAttempt(s, event({ studyMode: 'LEARN_MC' }), FIXED_NOW).next;
      }
      expect(s.status).toBe('MASTERED');
      expect(s.weightedStreak).toBeCloseTo(3.0, 5);
    });

    it('incorrect answer mid-journey resets streak fully', () => {
      let s = applyAttempt(
        NEW_PROGRESS,
        event({ studyMode: 'WRITE' }),
        FIXED_NOW,
      ).next;
      s = applyAttempt(s, event({ studyMode: 'WRITE' }), FIXED_NOW).next;
      expect(s.weightedStreak).toBeCloseTo(2.0, 5);
      s = applyAttempt(s, event({ outcome: 'INCORRECT' }), FIXED_NOW).next;
      expect(s.weightedStreak).toBe(0);
      expect(s.status).toBe('LEARNING');
    });
  });
});
