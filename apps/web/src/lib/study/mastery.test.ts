import { describe, expect, it } from 'vitest';

import { initialProgress, reduceProgress } from './mastery.js';

const AT = '2026-07-08T12:00:00.000Z';

describe('reduceProgress', () => {
  it('starts NEW with zero streak', () => {
    const p = initialProgress();
    expect(p.status).toBe('NEW');
    expect(p.weightedStreak).toBe(0);
  });

  it('promotes NEW -> LEARNING on first correct answer', () => {
    const next = reduceProgress(initialProgress(), { correct: true, usedHint: false, at: AT });
    expect(next.status).toBe('LEARNING');
    expect(next.weightedStreak).toBe(1);
    expect(next.masteredAt).toBeNull();
  });

  it('reaches MASTERED after four correct answers and seals masteredAt', () => {
    let p = initialProgress();
    for (let i = 0; i < 4; i++) p = reduceProgress(p, { correct: true, usedHint: false, at: AT });
    expect(p.status).toBe('MASTERED');
    expect(p.weightedStreak).toBe(4);
    expect(p.masteredAt).toBe(AT);
  });

  it('halves streak weight when a hint is used', () => {
    let p = initialProgress();
    p = reduceProgress(p, { correct: true, usedHint: true, at: AT });
    expect(p.weightedStreak).toBe(0.5);
  });

  it('resets streak on incorrect answer but keeps status non-NEW', () => {
    let p = reduceProgress(initialProgress(), { correct: true, usedHint: false, at: AT });
    p = reduceProgress(p, { correct: false, usedHint: false, at: AT });
    expect(p.status).toBe('LEARNING');
    expect(p.weightedStreak).toBe(0);
    expect(p.incorrectCount).toBe(1);
  });

  it('demotes MASTERED -> LEARNING and increments timesDemoted, keeps masteredAt', () => {
    let p = initialProgress();
    for (let i = 0; i < 4; i++) p = reduceProgress(p, { correct: true, usedHint: false, at: AT });
    expect(p.status).toBe('MASTERED');

    p = reduceProgress(p, { correct: false, usedHint: false, at: '2026-07-09T00:00:00.000Z' });
    expect(p.status).toBe('LEARNING');
    expect(p.timesDemoted).toBe(1);
    expect(p.masteredAt).toBe(AT); // preserved
  });
});
