import { computeStreaks } from './streaks';

describe('computeStreaks', () => {
  const today = '2026-10-27';

  it('is all zeros with no study days', () => {
    expect(computeStreaks([], today)).toEqual({
      currentStreak: 0,
      bestStreak: 0,
      studiedToday: false,
    });
  });

  it('counts consecutive days ending today', () => {
    const result = computeStreaks(
      ['2026-10-25', '2026-10-26', '2026-10-27'],
      today,
    );
    expect(result).toEqual({
      currentStreak: 3,
      bestStreak: 3,
      studiedToday: true,
    });
  });

  it('keeps the streak alive when today has no activity yet', () => {
    const result = computeStreaks(['2026-10-25', '2026-10-26'], today);
    expect(result.currentStreak).toBe(2);
    expect(result.studiedToday).toBe(false);
  });

  it('breaks the streak after a missed day', () => {
    const result = computeStreaks(['2026-10-24', '2026-10-25'], today);
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(2);
  });

  it('reports a longer earlier run as the best streak', () => {
    const result = computeStreaks(
      [
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
        '2026-10-26',
        '2026-10-27',
      ],
      today,
    );
    expect(result.currentStreak).toBe(2);
    expect(result.bestStreak).toBe(4);
  });

  it('ignores duplicates and order, and runs across month ends', () => {
    const result = computeStreaks(
      ['2026-11-01', '2026-10-31', '2026-10-31', '2026-10-30'],
      '2026-11-01',
    );
    expect(result.currentStreak).toBe(3);
    expect(result.bestStreak).toBe(3);
  });
});
