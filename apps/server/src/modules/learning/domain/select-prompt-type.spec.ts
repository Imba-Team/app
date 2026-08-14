import {
  RECENT_CORRECT_WINDOW_MS,
  selectPromptType,
  type RecentAttempt,
} from './select-prompt-type';

function attempt(overrides: Partial<RecentAttempt> = {}): RecentAttempt {
  return {
    studyMode: 'LEARN_MC',
    outcome: 'CORRECT',
    hintUsed: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('selectPromptType — MC unavailable', () => {
  it('falls back to LEARN_WRITTEN when the distractor pool is too small', () => {
    expect(
      selectPromptType({
        streak: 0,
        writtenThreshold: 1,
        distractorPoolSize: 2,
        recentAttempts: [],
      }),
    ).toBe('LEARN_WRITTEN');
  });
});

describe('selectPromptType — baseline (streak vs threshold)', () => {
  it('streak below threshold + no history → LEARN_MC', () => {
    expect(
      selectPromptType({
        streak: 0,
        writtenThreshold: 1,
        distractorPoolSize: 10,
        recentAttempts: [],
      }),
    ).toBe('LEARN_MC');
  });

  it('streak at/above threshold + no history → LEARN_WRITTEN', () => {
    expect(
      selectPromptType({
        streak: 1.5,
        writtenThreshold: 1,
        distractorPoolSize: 10,
        recentAttempts: [],
      }),
    ).toBe('LEARN_WRITTEN');
  });
});

describe('selectPromptType — recent struggling (compassion path)', () => {
  it('two misses in the last three attempts → LEARN_MC even when streak would say WRITTEN', () => {
    expect(
      selectPromptType({
        streak: 2.5,
        writtenThreshold: 1,
        distractorPoolSize: 10,
        recentAttempts: [
          attempt({ outcome: 'INCORRECT' }),
          attempt({ outcome: 'INCORRECT' }),
          attempt({ outcome: 'CORRECT' }),
        ],
      }),
    ).toBe('LEARN_MC');
  });

  it('one miss in three does not trigger the compassion path', () => {
    expect(
      selectPromptType({
        streak: 2.5,
        writtenThreshold: 1,
        distractorPoolSize: 10,
        recentAttempts: [
          attempt({ outcome: 'INCORRECT' }),
          attempt({ outcome: 'CORRECT' }),
          attempt({ outcome: 'CORRECT' }),
        ],
      }),
    ).toBe('LEARN_WRITTEN');
  });
});

describe('selectPromptType — recent correct MC (challenge path)', () => {
  it('recent correct MC without hint → escalate to LEARN_WRITTEN', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 30_000);
    expect(
      selectPromptType({
        streak: 0,
        writtenThreshold: 1,
        distractorPoolSize: 10,
        recentAttempts: [
          attempt({
            outcome: 'CORRECT',
            studyMode: 'LEARN_MC',
            createdAt: past,
          }),
        ],
        now,
      }),
    ).toBe('LEARN_WRITTEN');
  });

  it('recent correct MC with hint does NOT escalate', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 30_000);
    expect(
      selectPromptType({
        streak: 0,
        writtenThreshold: 1,
        distractorPoolSize: 10,
        recentAttempts: [
          attempt({
            outcome: 'CORRECT',
            studyMode: 'LEARN_MC',
            hintUsed: true,
            createdAt: past,
          }),
        ],
        now,
      }),
    ).toBe('LEARN_MC');
  });

  it('an old correct MC (outside the window) does NOT escalate', () => {
    const now = new Date();
    const stale = new Date(now.getTime() - RECENT_CORRECT_WINDOW_MS - 1000);
    expect(
      selectPromptType({
        streak: 0,
        writtenThreshold: 1,
        distractorPoolSize: 10,
        recentAttempts: [
          attempt({
            outcome: 'CORRECT',
            studyMode: 'LEARN_MC',
            createdAt: stale,
          }),
        ],
        now,
      }),
    ).toBe('LEARN_MC');
  });
});
