import {
  LearnAnswerDirection,
  StudyStrictness,
  TestQuestionType,
} from '@prisma/client';

import {
  gradeTestAttempt,
  type GradableAnswer,
  type GradableQuestion,
} from './grade-test-attempt';

function baseQuestion(
  overrides: Partial<GradableQuestion> = {},
): GradableQuestion {
  return {
    id: 'q1',
    flashcardId: 'card1',
    questionType: TestQuestionType.TEST_WRITTEN,
    expectedAnswer: 'photosynthesis',
    choices: [],
    correctChoiceIndex: null,
    answerDirection: LearnAnswerDirection.TERM_TO_DEFINITION,
    matchingPairs: [],
    ...overrides,
  };
}

describe('gradeTestAttempt — MC', () => {
  it('scores CORRECT when selectedChoiceIndex matches', () => {
    const q = baseQuestion({
      questionType: TestQuestionType.TEST_MC,
      choices: ['a', 'b', 'c', 'd'],
      correctChoiceIndex: 2,
    });
    const a: GradableAnswer = {
      questionAttemptId: 'q1',
      selectedChoiceIndex: 2,
    };
    const graded = gradeTestAttempt([q], [a], StudyStrictness.NORMAL);
    expect(graded.results[0].isCorrect).toBe(true);
    expect(graded.results[0].userAnswer).toBe('c');
    expect(graded.results[0].selectedChoiceIndex).toBe(2);
    expect(graded.results[0].slots).toBe(1);
    expect(graded.results[0].correctSlots).toBe(1);
  });

  it('scores INCORRECT when selectedChoiceIndex differs', () => {
    const q = baseQuestion({
      questionType: TestQuestionType.TEST_MC,
      choices: ['a', 'b', 'c', 'd'],
      correctChoiceIndex: 2,
    });
    const graded = gradeTestAttempt(
      [q],
      [{ questionAttemptId: 'q1', selectedChoiceIndex: 0 }],
      StudyStrictness.NORMAL,
    );
    expect(graded.results[0].isCorrect).toBe(false);
    expect(graded.results[0].userAnswer).toBe('a');
  });

  it('scores INCORRECT with no selection', () => {
    const q = baseQuestion({
      questionType: TestQuestionType.TEST_MC,
      choices: ['a', 'b', 'c', 'd'],
      correctChoiceIndex: 2,
    });
    const graded = gradeTestAttempt(
      [q],
      [{ questionAttemptId: 'q1' }],
      StudyStrictness.NORMAL,
    );
    expect(graded.results[0].isCorrect).toBe(false);
    expect(graded.results[0].userAnswer).toBeNull();
  });
});

describe('gradeTestAttempt — WRITTEN', () => {
  it('routes through the write-evaluator (case-insensitive)', () => {
    const q = baseQuestion({ expectedAnswer: 'photosynthesis' });
    const graded = gradeTestAttempt(
      [q],
      [{ questionAttemptId: 'q1', userAnswer: 'PHOTOSYNTHESIS' }],
      StudyStrictness.NORMAL,
    );
    expect(graded.results[0].isCorrect).toBe(true);
    expect(graded.results[0].similarity).toBe(1);
  });

  it('accepts a single-char typo under NORMAL strictness', () => {
    const q = baseQuestion({ expectedAnswer: 'photosynthesis' });
    const graded = gradeTestAttempt(
      [q],
      [{ questionAttemptId: 'q1', userAnswer: 'photosynthesic' }],
      StudyStrictness.NORMAL,
    );
    expect(graded.results[0].isCorrect).toBe(true);
  });

  it('rejects the same typo under STRICT strictness', () => {
    const q = baseQuestion({ expectedAnswer: 'photosynthesis' });
    const graded = gradeTestAttempt(
      [q],
      [{ questionAttemptId: 'q1', userAnswer: 'photosynthesic' }],
      StudyStrictness.STRICT,
    );
    expect(graded.results[0].isCorrect).toBe(false);
  });

  it('empty userAnswer is INCORRECT and surfaces null', () => {
    const q = baseQuestion({ expectedAnswer: 'photosynthesis' });
    const graded = gradeTestAttempt(
      [q],
      [{ questionAttemptId: 'q1', userAnswer: '' }],
      StudyStrictness.NORMAL,
    );
    expect(graded.results[0].isCorrect).toBe(false);
    expect(graded.results[0].userAnswer).toBeNull();
  });
});

describe('gradeTestAttempt — TF', () => {
  it('correctChoiceIndex 0 (presented=true) + userIsTrue=true → CORRECT', () => {
    const q = baseQuestion({
      questionType: TestQuestionType.TEST_TF,
      choices: ['photosynthesis'],
      correctChoiceIndex: 0,
    });
    const graded = gradeTestAttempt(
      [q],
      [{ questionAttemptId: 'q1', userIsTrue: true }],
      StudyStrictness.NORMAL,
    );
    expect(graded.results[0].isCorrect).toBe(true);
    expect(graded.results[0].userAnswer).toBe('true');
  });

  it('correctChoiceIndex 1 (presented=false) + userIsTrue=false → CORRECT', () => {
    const q = baseQuestion({
      questionType: TestQuestionType.TEST_TF,
      choices: ['some decoy'],
      correctChoiceIndex: 1,
    });
    const graded = gradeTestAttempt(
      [q],
      [{ questionAttemptId: 'q1', userIsTrue: false }],
      StudyStrictness.NORMAL,
    );
    expect(graded.results[0].isCorrect).toBe(true);
    expect(graded.results[0].userAnswer).toBe('false');
  });

  it('unanswered TF is INCORRECT', () => {
    const q = baseQuestion({
      questionType: TestQuestionType.TEST_TF,
      choices: ['photosynthesis'],
      correctChoiceIndex: 0,
    });
    const graded = gradeTestAttempt(
      [q],
      [{ questionAttemptId: 'q1' }],
      StudyStrictness.NORMAL,
    );
    expect(graded.results[0].isCorrect).toBe(false);
    expect(graded.results[0].userAnswer).toBeNull();
  });
});

describe('gradeTestAttempt — MATCH', () => {
  const q = baseQuestion({
    questionType: TestQuestionType.TEST_MATCH,
    matchingPairs: [
      { pairId: 'p1', flashcardId: 'a' },
      { pairId: 'p2', flashcardId: 'b' },
      { pairId: 'p3', flashcardId: 'c' },
    ],
  });

  it('all pairs correct → question isCorrect + slots == pairs', () => {
    const graded = gradeTestAttempt(
      [q],
      [
        {
          questionAttemptId: 'q1',
          matchingPicks: [
            { pairId: 'p1', userMatchedFlashcardId: 'a' },
            { pairId: 'p2', userMatchedFlashcardId: 'b' },
            { pairId: 'p3', userMatchedFlashcardId: 'c' },
          ],
        },
      ],
      StudyStrictness.NORMAL,
    );
    expect(graded.results[0].isCorrect).toBe(true);
    expect(graded.results[0].slots).toBe(3);
    expect(graded.results[0].correctSlots).toBe(3);
    expect(graded.results[0].pairs.every((p) => p.isCorrect)).toBe(true);
  });

  it('partial credit — 2 of 3 correct', () => {
    const graded = gradeTestAttempt(
      [q],
      [
        {
          questionAttemptId: 'q1',
          matchingPicks: [
            { pairId: 'p1', userMatchedFlashcardId: 'a' },
            { pairId: 'p2', userMatchedFlashcardId: 'c' }, // wrong
            { pairId: 'p3', userMatchedFlashcardId: 'c' },
          ],
        },
      ],
      StudyStrictness.NORMAL,
    );
    expect(graded.results[0].isCorrect).toBe(false);
    expect(graded.results[0].slots).toBe(3);
    expect(graded.results[0].correctSlots).toBe(2);
  });

  it('null picks count as incorrect', () => {
    const graded = gradeTestAttempt(
      [q],
      [
        {
          questionAttemptId: 'q1',
          matchingPicks: [
            { pairId: 'p1', userMatchedFlashcardId: null },
            { pairId: 'p2', userMatchedFlashcardId: null },
            { pairId: 'p3', userMatchedFlashcardId: null },
          ],
        },
      ],
      StudyStrictness.NORMAL,
    );
    expect(graded.results[0].correctSlots).toBe(0);
  });

  it('missing pick entry counts as unanswered (incorrect)', () => {
    const graded = gradeTestAttempt(
      [q],
      [
        {
          questionAttemptId: 'q1',
          matchingPicks: [{ pairId: 'p1', userMatchedFlashcardId: 'a' }],
        },
      ],
      StudyStrictness.NORMAL,
    );
    expect(graded.results[0].correctSlots).toBe(1);
    expect(
      graded.results[0].pairs.filter((p) => p.userMatchedFlashcardId === null),
    ).toHaveLength(2);
  });
});

describe('gradeTestAttempt — aggregate scoring', () => {
  it('sums slots correctly across mixed types', () => {
    const questions: GradableQuestion[] = [
      baseQuestion({ id: 'q1', questionType: TestQuestionType.TEST_WRITTEN }),
      baseQuestion({
        id: 'q2',
        questionType: TestQuestionType.TEST_MC,
        choices: ['a', 'b', 'c', 'd'],
        correctChoiceIndex: 0,
      }),
      baseQuestion({
        id: 'q3',
        questionType: TestQuestionType.TEST_MATCH,
        matchingPairs: [
          { pairId: 'p1', flashcardId: 'x' },
          { pairId: 'p2', flashcardId: 'y' },
          { pairId: 'p3', flashcardId: 'z' },
        ],
      }),
    ];
    const answers: GradableAnswer[] = [
      { questionAttemptId: 'q1', userAnswer: 'photosynthesis' }, // correct
      { questionAttemptId: 'q2', selectedChoiceIndex: 1 }, // wrong
      {
        questionAttemptId: 'q3',
        matchingPicks: [
          { pairId: 'p1', userMatchedFlashcardId: 'x' }, // correct
          { pairId: 'p2', userMatchedFlashcardId: 'z' }, // wrong
          { pairId: 'p3', userMatchedFlashcardId: 'z' }, // correct
        ],
      },
    ];
    const graded = gradeTestAttempt(questions, answers, StudyStrictness.NORMAL);
    // Total slots: 1 + 1 + 3 = 5. Correct: 1 (q1) + 0 (q2) + 2 (q3) = 3.
    expect(graded.totalSlots).toBe(5);
    expect(graded.correctSlots).toBe(3);
    expect(graded.score).toBe(60);
  });

  it('score is 0 when totalSlots is 0', () => {
    const graded = gradeTestAttempt([], [], StudyStrictness.NORMAL);
    expect(graded.score).toBe(0);
    expect(graded.totalSlots).toBe(0);
  });

  it('rounds score to two decimals', () => {
    const questions: GradableQuestion[] = Array.from({ length: 7 }, (_, i) =>
      baseQuestion({ id: `q${i}`, expectedAnswer: 'x' }),
    );
    const answers: GradableAnswer[] = questions.map((q, i) => ({
      questionAttemptId: q.id,
      userAnswer: i < 3 ? 'x' : 'y',
    }));
    // 3/7 ≈ 42.857142... → 42.86
    const graded = gradeTestAttempt(questions, answers, StudyStrictness.NORMAL);
    expect(graded.score).toBe(42.86);
  });
});
