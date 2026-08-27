import {
  LearnAnswerDirection,
  StudyStrictness,
  TestQuestionType,
} from '@prisma/client';

import {
  evaluateWrittenAnswer,
  type Strictness,
} from 'src/modules/learning/domain/write-evaluator';

/**
 * Per-question spec fed to the grader. Callers project persisted
 * TestQuestionAttempt rows down to this shape before invoking so the
 * grader is fully pure and unit-testable.
 */
export interface GradableQuestion {
  id: string;
  flashcardId: string;
  questionType: TestQuestionType;
  expectedAnswer: string;
  choices: string[];
  correctChoiceIndex: number | null;
  answerDirection: LearnAnswerDirection;
  /** Anchor cards for TEST_MATCH (id + row id per pair). Empty for
   *  other types. */
  matchingPairs: { pairId: string; flashcardId: string }[];
}

/** One entry per question in the client's submit payload. */
export interface GradableAnswer {
  questionAttemptId: string;
  /** WRITTEN — verbatim learner input. */
  userAnswer?: string;
  /** MC — index into the question's `choices`. */
  selectedChoiceIndex?: number;
  /** TF — true if the learner said the presented pairing is correct. */
  userIsTrue?: boolean;
  /** MATCH — for each pair, which flashcard's definition (or term,
   *  under reverse direction) the learner dropped on it. */
  matchingPicks?: { pairId: string; userMatchedFlashcardId: string | null }[];
}

/** One pair's judgment inside a matching question. */
export interface GradedPair {
  pairId: string;
  flashcardId: string;
  userMatchedFlashcardId: string | null;
  isCorrect: boolean;
}

/** Grader output — one entry per question. Callers project this to
 *  prisma updates + downstream SRS calls. */
export interface GradedQuestion {
  questionAttemptId: string;
  questionType: TestQuestionType;
  /** Anchor flashcard for single-slot questions; first anchor for
   *  matching (mirrors TestQuestionAttempt.flashcardId semantics). */
  flashcardId: string;
  /** True when the question is fully correct — MC/TF/WRITTEN as a
   *  whole, or ALL pairs correct for matching. */
  isCorrect: boolean;
  /** Raw learner input echoed back for persistence. */
  userAnswer: string | null;
  /** MC only — nullable for other types. */
  selectedChoiceIndex: number | null;
  /** Written only — similarity from the evaluator (0.000–1.000). */
  similarity: number | null;
  /** MATCH only — per-pair judgments. */
  pairs: GradedPair[];
  /** How many scoring slots this question contributes to
   *  totalQuestions. 1 for single-slot; N for matching. */
  slots: number;
  /** How many of this question's slots were correct. Matches
   *  isCorrect for single-slot (0 or 1); for matching it's the count
   *  of correct pairs. */
  correctSlots: number;
}

export interface GradedTestAttempt {
  results: GradedQuestion[];
  totalSlots: number;
  correctSlots: number;
  /** 0.00–100.00 percentage; 0 when totalSlots is 0. */
  score: number;
}

/**
 * Grade a full submission. Pure — no DB, no SRS calls; those are the
 * caller's job. Answers not present in the payload count as blank
 * (WRITTEN: empty string; MC: no selection; TF: unanswered; MATCH:
 * all pairs blank).
 */
export function gradeTestAttempt(
  questions: readonly GradableQuestion[],
  answers: readonly GradableAnswer[],
  strictness: StudyStrictness,
): GradedTestAttempt {
  const answerByQuestionId = new Map(
    answers.map((a) => [a.questionAttemptId, a]),
  );
  const strictnessKey: Strictness = strictness;

  const results: GradedQuestion[] = [];
  let totalSlots = 0;
  let correctSlots = 0;

  for (const q of questions) {
    const a = answerByQuestionId.get(q.id);
    const graded = gradeOne(q, a, strictnessKey);
    results.push(graded);
    totalSlots += graded.slots;
    correctSlots += graded.correctSlots;
  }

  const score = totalSlots > 0 ? (correctSlots / totalSlots) * 100 : 0;
  return {
    results,
    totalSlots,
    correctSlots,
    score: Number(score.toFixed(2)),
  };
}

function gradeOne(
  q: GradableQuestion,
  a: GradableAnswer | undefined,
  strictness: Strictness,
): GradedQuestion {
  switch (q.questionType) {
    case 'TEST_MC':
      return gradeMc(q, a);
    case 'TEST_WRITTEN':
      return gradeWritten(q, a, strictness);
    case 'TEST_TF':
      return gradeTf(q, a);
    case 'TEST_MATCH':
      return gradeMatching(q, a);
  }
}

function gradeMc(
  q: GradableQuestion,
  a: GradableAnswer | undefined,
): GradedQuestion {
  const selected = a?.selectedChoiceIndex ?? null;
  const isCorrect =
    selected !== null &&
    q.correctChoiceIndex !== null &&
    selected === q.correctChoiceIndex;
  const userAnswer =
    selected !== null && selected >= 0 && selected < q.choices.length
      ? q.choices[selected]
      : null;
  return {
    questionAttemptId: q.id,
    questionType: q.questionType,
    flashcardId: q.flashcardId,
    isCorrect,
    userAnswer,
    selectedChoiceIndex: selected,
    similarity: null,
    pairs: [],
    slots: 1,
    correctSlots: isCorrect ? 1 : 0,
  };
}

function gradeWritten(
  q: GradableQuestion,
  a: GradableAnswer | undefined,
  strictness: Strictness,
): GradedQuestion {
  const userAnswer = a?.userAnswer ?? '';
  // No alternates in the test grader — the SRS spec grades against
  // the canonical answer only. Direction-specific expected text was
  // already resolved at generation time.
  const evaluation = evaluateWrittenAnswer(
    userAnswer,
    q.expectedAnswer,
    [],
    strictness,
  );
  const isCorrect = evaluation.outcome === 'CORRECT';
  return {
    questionAttemptId: q.id,
    questionType: q.questionType,
    flashcardId: q.flashcardId,
    isCorrect,
    userAnswer: userAnswer.length > 0 ? userAnswer : null,
    selectedChoiceIndex: null,
    similarity: evaluation.similarity,
    pairs: [],
    slots: 1,
    correctSlots: isCorrect ? 1 : 0,
  };
}

function gradeTf(
  q: GradableQuestion,
  a: GradableAnswer | undefined,
): GradedQuestion {
  // correctChoiceIndex convention: 0 = the presented pairing is
  // actually TRUE; 1 = it's FALSE.
  const expectedIsTrue = q.correctChoiceIndex === 0;
  const userIsTrue = a?.userIsTrue;
  const isCorrect = userIsTrue !== undefined && userIsTrue === expectedIsTrue;
  return {
    questionAttemptId: q.id,
    questionType: q.questionType,
    flashcardId: q.flashcardId,
    isCorrect,
    userAnswer: userIsTrue === undefined ? null : userIsTrue ? 'true' : 'false',
    selectedChoiceIndex: userIsTrue === undefined ? null : userIsTrue ? 0 : 1,
    similarity: null,
    pairs: [],
    slots: 1,
    correctSlots: isCorrect ? 1 : 0,
  };
}

function gradeMatching(
  q: GradableQuestion,
  a: GradableAnswer | undefined,
): GradedQuestion {
  const pickByPairId = new Map(
    (a?.matchingPicks ?? []).map((p) => [p.pairId, p.userMatchedFlashcardId]),
  );
  const pairs: GradedPair[] = q.matchingPairs.map((pair) => {
    const userMatchedFlashcardId = pickByPairId.get(pair.pairId) ?? null;
    return {
      pairId: pair.pairId,
      flashcardId: pair.flashcardId,
      userMatchedFlashcardId,
      isCorrect: userMatchedFlashcardId === pair.flashcardId,
    };
  });
  const correctSlots = pairs.filter((p) => p.isCorrect).length;
  return {
    questionAttemptId: q.id,
    questionType: q.questionType,
    flashcardId: q.flashcardId,
    // The overall question is "correct" only when EVERY pair is
    // correct — mostly cosmetic; the score uses slots/correctSlots.
    isCorrect: pairs.length > 0 && correctSlots === pairs.length,
    userAnswer: null,
    selectedChoiceIndex: null,
    similarity: null,
    pairs,
    slots: pairs.length,
    correctSlots,
  };
}
