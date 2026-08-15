import { LearnAnswerDirection, TestQuestionType } from '@prisma/client';

import {
  generateTest,
  type GeneratorCard,
  type GeneratorPreferences,
} from './test-question-generator';

/** Build N deterministic cards for pool sizing tests. */
function makeCards(n: number): GeneratorCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `card-${i}`,
    term: `term-${i}`,
    // Vary length so the length-bucket distractor picker has room.
    definition: `definition of card ${i}${' extra'.repeat(i % 3)}`,
  }));
}

const BASE_PREFS: GeneratorPreferences = {
  questionCount: 20,
  allowedTypes: [
    TestQuestionType.TEST_MC,
    TestQuestionType.TEST_WRITTEN,
    TestQuestionType.TEST_TF,
    TestQuestionType.TEST_MATCH,
  ],
  answerDirection: LearnAnswerDirection.TERM_TO_DEFINITION,
  shuffleEnabled: false,
  matchingPairCount: 5,
};

describe('generateTest — empty inputs', () => {
  it('returns nothing when the card pool is empty', () => {
    const result = generateTest([], BASE_PREFS);
    expect(result.questions).toEqual([]);
    expect(result.totalQuestions).toBe(0);
  });

  it('returns nothing when questionCount is zero', () => {
    const result = generateTest(makeCards(10), {
      ...BASE_PREFS,
      questionCount: 0,
    });
    expect(result.questions).toEqual([]);
    expect(result.totalQuestions).toBe(0);
  });

  it('returns nothing when no types are allowed', () => {
    const result = generateTest(makeCards(10), {
      ...BASE_PREFS,
      allowedTypes: [],
    });
    expect(result.questions).toEqual([]);
    expect(result.totalQuestions).toBe(0);
  });
});

describe('generateTest — pool sizing', () => {
  it('caps totalQuestions at the pool size for single-slot only', () => {
    // No matching allowed; 6 cards, requesting 20 — we get 6.
    const result = generateTest(makeCards(6), {
      ...BASE_PREFS,
      allowedTypes: [
        TestQuestionType.TEST_MC,
        TestQuestionType.TEST_WRITTEN,
        TestQuestionType.TEST_TF,
      ],
    });
    expect(result.totalQuestions).toBe(6);
    expect(result.questions).toHaveLength(6);
  });

  it('emits one matching question consuming matchingPairCount cards + single-slot fill', () => {
    // 12 cards, 20 requested, matchingPairCount = 5 → 1 matching
    // (5 slots) + 7 single (7 slots) = 12 slots.
    const result = generateTest(makeCards(12), BASE_PREFS);
    expect(result.totalQuestions).toBe(12);
    expect(result.questions[0].questionType).toBe(TestQuestionType.TEST_MATCH);
    expect(result.questions[0].matchingPairs).toHaveLength(5);
    // Remaining 7 questions are single-slot.
    for (const q of result.questions.slice(1)) {
      expect(q.questionType).not.toBe(TestQuestionType.TEST_MATCH);
      expect(q.matchingPairs).toHaveLength(0);
    }
  });

  it('honours questionCount as an upper bound', () => {
    // 20 cards but only 8 requested — with matching (5 slots) we fill
    // 3 more single-slot to reach 8 total.
    const result = generateTest(makeCards(20), {
      ...BASE_PREFS,
      questionCount: 8,
    });
    expect(result.totalQuestions).toBe(8);
  });

  it('skips matching when the pool is exactly matchingPairCount', () => {
    // A test made of just a matching grid with no other questions is
    // flat — generator degrades to single-slot only.
    const result = generateTest(makeCards(5), BASE_PREFS);
    expect(
      result.questions.every(
        (q) => q.questionType !== TestQuestionType.TEST_MATCH,
      ),
    ).toBe(true);
  });

  it('skips matching when questionCount is too small to fit it plus a single-slot', () => {
    // questionCount = 5 (== matchingPairCount) and matching consumes
    // all 5 slots — but the rule says at least one non-matching too.
    const result = generateTest(makeCards(10), {
      ...BASE_PREFS,
      questionCount: 5,
    });
    expect(
      result.questions.every(
        (q) => q.questionType !== TestQuestionType.TEST_MATCH,
      ),
    ).toBe(true);
  });
});

describe('generateTest — feasibility filtering', () => {
  it('falls back to WRITTEN when the pool is too small for MC/TF', () => {
    // Only WRITTEN feasible with 1 card (MC needs 4, TF needs 2).
    const result = generateTest(makeCards(1), {
      ...BASE_PREFS,
      allowedTypes: [
        TestQuestionType.TEST_MC,
        TestQuestionType.TEST_WRITTEN,
        TestQuestionType.TEST_TF,
      ],
    });
    expect(result.totalQuestions).toBe(1);
    expect(result.questions[0].questionType).toBe(
      TestQuestionType.TEST_WRITTEN,
    );
  });

  it('produces nothing when the only allowed single type is unfeasible', () => {
    // MC needs 4 cards; only 2 available.
    const result = generateTest(makeCards(2), {
      ...BASE_PREFS,
      allowedTypes: [TestQuestionType.TEST_MC],
    });
    expect(result.totalQuestions).toBe(0);
    expect(result.questions).toEqual([]);
  });
});

describe('generateTest — MC shape', () => {
  it('renders 4 choices with the correct one at correctChoiceIndex', () => {
    const result = generateTest(makeCards(10), {
      ...BASE_PREFS,
      questionCount: 5,
      allowedTypes: [TestQuestionType.TEST_MC],
    });
    for (const q of result.questions) {
      expect(q.questionType).toBe(TestQuestionType.TEST_MC);
      expect(q.choices).toHaveLength(4);
      expect(q.correctChoiceIndex).not.toBeNull();
      expect(q.choices[q.correctChoiceIndex!]).toBe(q.expectedAnswer);
    }
  });
});

describe('generateTest — WRITTEN shape', () => {
  it('emits WRITTEN questions with no choices and no correctChoiceIndex', () => {
    const result = generateTest(makeCards(5), {
      ...BASE_PREFS,
      questionCount: 5,
      allowedTypes: [TestQuestionType.TEST_WRITTEN],
    });
    for (const q of result.questions) {
      expect(q.questionType).toBe(TestQuestionType.TEST_WRITTEN);
      expect(q.choices).toEqual([]);
      expect(q.correctChoiceIndex).toBeNull();
      expect(q.expectedAnswer).toBeTruthy();
      expect(q.promptText).toBeTruthy();
    }
  });
});

describe('generateTest — TF shape', () => {
  it('emits TF questions with a single presented candidate + correctChoiceIndex marking TRUE (0) or FALSE (1)', () => {
    const result = generateTest(makeCards(10), {
      ...BASE_PREFS,
      questionCount: 8,
      allowedTypes: [TestQuestionType.TEST_TF],
    });
    for (const q of result.questions) {
      expect(q.questionType).toBe(TestQuestionType.TEST_TF);
      expect(q.choices).toHaveLength(1);
      expect(q.correctChoiceIndex === 0 || q.correctChoiceIndex === 1).toBe(
        true,
      );
    }
  });
});

describe('generateTest — direction resolution', () => {
  it('produces TERM_TO_DEFINITION prompts under the fixed pref', () => {
    const cards = makeCards(6);
    const result = generateTest(cards, {
      ...BASE_PREFS,
      answerDirection: LearnAnswerDirection.TERM_TO_DEFINITION,
      questionCount: 6,
      allowedTypes: [TestQuestionType.TEST_WRITTEN],
    });
    for (const q of result.questions) {
      const card = cards.find((c) => c.id === q.flashcardId)!;
      expect(q.promptText).toBe(card.term);
      expect(q.expectedAnswer).toBe(card.definition);
      expect(q.answerDirection).toBe('TERM_TO_DEFINITION');
    }
  });

  it('produces DEFINITION_TO_TERM prompts under the fixed pref', () => {
    const cards = makeCards(6);
    const result = generateTest(cards, {
      ...BASE_PREFS,
      answerDirection: LearnAnswerDirection.DEFINITION_TO_TERM,
      questionCount: 6,
      allowedTypes: [TestQuestionType.TEST_WRITTEN],
    });
    for (const q of result.questions) {
      const card = cards.find((c) => c.id === q.flashcardId)!;
      expect(q.promptText).toBe(card.definition);
      expect(q.expectedAnswer).toBe(card.term);
      expect(q.answerDirection).toBe('DEFINITION_TO_TERM');
    }
  });

  it('emits only concrete directions under MIXED (never MIXED itself)', () => {
    const result = generateTest(makeCards(20), {
      ...BASE_PREFS,
      answerDirection: LearnAnswerDirection.MIXED,
      questionCount: 20,
    });
    for (const q of result.questions) {
      expect(['TERM_TO_DEFINITION', 'DEFINITION_TO_TERM']).toContain(
        q.answerDirection,
      );
    }
  });
});

describe('generateTest — ordering', () => {
  it('assigns unique sequential orderIndex values starting at 0', () => {
    const result = generateTest(makeCards(12), BASE_PREFS);
    const indices = result.questions.map((q) => q.orderIndex);
    expect(indices).toEqual(indices.map((_, i) => i));
  });
});
