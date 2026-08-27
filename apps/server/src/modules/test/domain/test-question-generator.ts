import { LearnAnswerDirection, TestQuestionType } from '@prisma/client';

import { pickDistractors } from 'src/modules/learning/domain/pick-distractors';
import { shuffle } from 'src/modules/learning/domain/shuffle';

/**
 * Minimal card shape the generator needs. Callers project their
 * database rows down to this before invoking so the pure function
 * stays testable without a prisma fixture.
 */
export interface GeneratorCard {
  id: string;
  term: string;
  definition: string;
}

/** Every resolved question direction the generator can emit. MIXED is
 *  a preference — never a per-question value. */
export type ResolvedDirection = 'TERM_TO_DEFINITION' | 'DEFINITION_TO_TERM';

/**
 * Anchor for one pair inside a matching question. `flashcardId` is the
 * card whose term is on the left; `distractorAnchorFlashcardIds` are
 * the OTHER anchor flashcard IDs in the same question — the client
 * uses this to render the shuffled right-column candidates.
 */
export interface MatchingPairSpec {
  flashcardId: string;
}

/**
 * A single question ready to be persisted as a TestQuestionAttempt
 * row (plus `matchingPairs` for TEST_MATCH). Callers turn this into
 * prisma inserts inside a transaction.
 */
export interface TestQuestionSpec {
  /** Flashcard the question is anchored on. For TEST_MATCH this is
   *  the FIRST anchor in the pair set — arbitrary but consistent. */
  flashcardId: string;
  questionType: TestQuestionType;
  promptText: string;
  expectedAnswer: string;
  choices: string[];
  correctChoiceIndex: number | null;
  answerDirection: LearnAnswerDirection;
  orderIndex: number;
  /** Non-empty only for TEST_MATCH. Length == matchingPairCount. */
  matchingPairs: MatchingPairSpec[];
}

export interface GeneratorPreferences {
  questionCount: number;
  allowedTypes: TestQuestionType[];
  answerDirection: LearnAnswerDirection;
  shuffleEnabled: boolean;
  matchingPairCount: number;
}

/**
 * Cards required for each single-slot question type. Matching is
 * handled separately below — its minimum is `matchingPairCount`.
 */
const MIN_CARDS_FOR: Record<Exclude<TestQuestionType, 'TEST_MATCH'>, number> = {
  TEST_MC: 4, // needs 3 distractors
  TEST_WRITTEN: 1,
  TEST_TF: 2, // needs 1 decoy definition
};

/**
 * Roll a resolved direction — MIXED spins per call, otherwise the
 * preference passes through. Isolated so tests can stub it.
 */
function resolveDirection(pref: LearnAnswerDirection): ResolvedDirection {
  if (pref === LearnAnswerDirection.MIXED) {
    return Math.random() < 0.5 ? 'TERM_TO_DEFINITION' : 'DEFINITION_TO_TERM';
  }
  return pref;
}

function promptOf(card: GeneratorCard, direction: ResolvedDirection): string {
  return direction === 'DEFINITION_TO_TERM' ? card.definition : card.term;
}

function answerOf(card: GeneratorCard, direction: ResolvedDirection): string {
  return direction === 'DEFINITION_TO_TERM' ? card.term : card.definition;
}

/**
 * Given a card and the resolved direction, pick which single-slot
 * question types are actually feasible with the available pool size.
 * Filters `allowedTypes` down to types whose card requirements fit.
 */
function feasibleTypesFor(
  poolSize: number,
  allowedSingleTypes: readonly Exclude<TestQuestionType, 'TEST_MATCH'>[],
): Exclude<TestQuestionType, 'TEST_MATCH'>[] {
  return allowedSingleTypes.filter((t) => poolSize >= MIN_CARDS_FOR[t]);
}

/**
 * Build one MC question — 3 length-bucketed distractors + the correct
 * answer, shuffled. `answerText` is what the learner must recognise.
 */
function generateMc(
  card: GeneratorCard,
  direction: ResolvedDirection,
  otherCards: readonly GeneratorCard[],
  orderIndex: number,
): TestQuestionSpec {
  const answerText = answerOf(card, direction);
  const distractorPool = otherCards.map((c) => ({
    id: c.id,
    answerText: answerOf(c, direction),
  }));
  const distractors = pickDistractors(
    { id: card.id, answerText },
    distractorPool,
    3,
  );
  const choices = shuffle([answerText, ...distractors]);
  return {
    flashcardId: card.id,
    questionType: TestQuestionType.TEST_MC,
    promptText: promptOf(card, direction),
    expectedAnswer: answerText,
    choices,
    correctChoiceIndex: choices.indexOf(answerText),
    answerDirection: direction,
    orderIndex,
    matchingPairs: [],
  };
}

/**
 * Build one WRITTEN question — no choices; the grader compares
 * `userAnswer` against `expectedAnswer` via the write-evaluator.
 */
function generateWritten(
  card: GeneratorCard,
  direction: ResolvedDirection,
  orderIndex: number,
): TestQuestionSpec {
  return {
    flashcardId: card.id,
    questionType: TestQuestionType.TEST_WRITTEN,
    promptText: promptOf(card, direction),
    expectedAnswer: answerOf(card, direction),
    choices: [],
    correctChoiceIndex: null,
    answerDirection: direction,
    orderIndex,
    matchingPairs: [],
  };
}

/**
 * Build one TF question — 50/50 present either the correct pairing
 * or a length-bucketed decoy from another card. `correctChoiceIndex`
 * is the source of truth: 0 = the presented pairing is TRUE, 1 = it's
 * FALSE. The learner sees a term with a candidate definition and
 * presses True or False.
 */
function generateTf(
  card: GeneratorCard,
  direction: ResolvedDirection,
  otherCards: readonly GeneratorCard[],
  orderIndex: number,
): TestQuestionSpec {
  const trueAnswer = answerOf(card, direction);
  const isPresentedTrue = Math.random() < 0.5;
  let presentedAnswer: string;
  if (isPresentedTrue) {
    presentedAnswer = trueAnswer;
  } else {
    // Length-bucketed decoy from a different card — pickDistractors
    // asks for 1 and we take the first (or fall back to any other
    // card's answer text if the bucket empties).
    const decoyPool = otherCards.map((c) => ({
      id: c.id,
      answerText: answerOf(c, direction),
    }));
    const decoy = pickDistractors(
      { id: card.id, answerText: trueAnswer },
      decoyPool,
      1,
    );
    presentedAnswer = decoy[0] ?? trueAnswer;
    // If the pool couldn't produce a distinct decoy the "false"
    // question would be unwinnable — flip back to true so the learner
    // isn't punished for a small set.
    if (presentedAnswer === trueAnswer) {
      return {
        flashcardId: card.id,
        questionType: TestQuestionType.TEST_TF,
        promptText: promptOf(card, direction),
        expectedAnswer: trueAnswer,
        choices: [presentedAnswer],
        correctChoiceIndex: 0,
        answerDirection: direction,
        orderIndex,
        matchingPairs: [],
      };
    }
  }
  return {
    flashcardId: card.id,
    questionType: TestQuestionType.TEST_TF,
    promptText: promptOf(card, direction),
    expectedAnswer: trueAnswer,
    choices: [presentedAnswer],
    correctChoiceIndex: isPresentedTrue ? 0 : 1,
    answerDirection: direction,
    orderIndex,
    matchingPairs: [],
  };
}

/**
 * Build ONE matching question consuming `matchingPairCount` cards.
 * The generator picks a resolved direction for the whole question
 * (all pairs use the same direction — mixing within a single matching
 * grid would be confusing). Each pair anchors on `flashcardId`; the
 * client shuffles anchors + candidates independently.
 */
function generateMatching(
  cards: readonly GeneratorCard[],
  direction: ResolvedDirection,
  orderIndex: number,
): TestQuestionSpec {
  const anchor = cards[0];
  return {
    flashcardId: anchor.id,
    questionType: TestQuestionType.TEST_MATCH,
    // The prompt text is display-only for matching (a header for the
    // grid). Anchors + candidates are on `matchingPairs`.
    promptText: 'Match each term with its definition.',
    expectedAnswer: '',
    choices: [],
    correctChoiceIndex: null,
    answerDirection: direction,
    orderIndex,
    matchingPairs: cards.map((c) => ({ flashcardId: c.id })),
  };
}

export interface GeneratedTest {
  questions: TestQuestionSpec[];
  /** Sum of scoring slots — matching contributes `matchingPairCount`,
   *  others 1. Persisted as TestAttempt.totalQuestions. */
  totalQuestions: number;
}

/**
 * Generate a full test from the caller's card pool + preferences.
 * Pure function so the service layer can wrap it in a transaction
 * without any state leaking in.
 *
 * Rules:
 *  - Shuffle the pool up front when the pref is on; otherwise honour
 *    the caller-provided order (usually Flashcard.orderIndex).
 *  - If TEST_MATCH is allowed AND the pool has enough cards for the
 *    matching question plus at least one single-slot question, emit
 *    exactly one matching question at position 0 consuming
 *    `matchingPairCount` cards.
 *  - Fill the remaining slots by picking cards sequentially from the
 *    remaining pool. For each card, pick a random type from the
 *    feasible subset of allowedTypes (feasibility depends on how
 *    many "other" cards remain for distractors/decoys).
 *  - Stop when either the requested questionCount is met OR the pool
 *    runs out.
 */
export function generateTest(
  cards: readonly GeneratorCard[],
  prefs: GeneratorPreferences,
): GeneratedTest {
  if (cards.length === 0 || prefs.questionCount <= 0) {
    return { questions: [], totalQuestions: 0 };
  }

  const pool = prefs.shuffleEnabled ? shuffle(cards) : [...cards];
  const questions: TestQuestionSpec[] = [];
  let totalQuestions = 0;
  let cursor = 0;
  let orderIndex = 0;

  // Matching question — take the first N cards if feasible. The
  // remaining pool feeds the single-slot questions.
  const matchingWanted = prefs.allowedTypes.includes(
    TestQuestionType.TEST_MATCH,
  );
  const matchingSize = prefs.matchingPairCount;
  const roomForMatching =
    matchingWanted &&
    pool.length >= matchingSize &&
    prefs.questionCount >= matchingSize + 1 &&
    // Skip if matching would consume the entire pool with no room
    // for at least one single-slot question — a test made entirely
    // of one matching grid feels flat.
    pool.length > matchingSize;

  if (roomForMatching) {
    const matchingCards = pool.slice(cursor, cursor + matchingSize);
    const dir = resolveDirection(prefs.answerDirection);
    questions.push(generateMatching(matchingCards, dir, orderIndex));
    totalQuestions += matchingSize;
    cursor += matchingSize;
    orderIndex += 1;
  }

  const allowedSingle = prefs.allowedTypes.filter(
    (t): t is Exclude<TestQuestionType, 'TEST_MATCH'> =>
      t !== TestQuestionType.TEST_MATCH,
  );

  while (
    cursor < pool.length &&
    totalQuestions < prefs.questionCount &&
    allowedSingle.length > 0
  ) {
    const card = pool[cursor];
    const otherCards = pool.filter((c) => c.id !== card.id);
    const feasible = feasibleTypesFor(pool.length, allowedSingle);
    if (feasible.length === 0) break;
    // Random type per card — bounded by feasibility.
    const type = feasible[Math.floor(Math.random() * feasible.length)];
    const dir = resolveDirection(prefs.answerDirection);
    if (type === 'TEST_MC') {
      questions.push(generateMc(card, dir, otherCards, orderIndex));
    } else if (type === 'TEST_WRITTEN') {
      questions.push(generateWritten(card, dir, orderIndex));
    } else {
      questions.push(generateTf(card, dir, otherCards, orderIndex));
    }
    totalQuestions += 1;
    cursor += 1;
    orderIndex += 1;
  }

  return { questions, totalQuestions };
}
