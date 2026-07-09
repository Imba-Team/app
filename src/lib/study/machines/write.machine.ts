import { setup, assign } from 'xstate';

/**
 * Write Mode state machine (SRS §5.7).
 *
 * Answer evaluation uses Levenshtein distance ≤ 1 for words of 6+ characters,
 * exact match otherwise (SRS §5.7 FR-WRITE-002). The evaluator lives here so both
 * apps score identically before the network round-trip lands.
 */

export interface WriteCard {
  cardId: string;
  prompt: string;
  answer: string;
}

interface WriteContext {
  cards: WriteCard[];
  currentIndex: number;
  correct: number;
  incorrect: number;
  usedHint: boolean;
}

type WriteEvent =
  | { type: 'START'; cards: WriteCard[] }
  | { type: 'SUBMIT'; guess: string }
  | { type: 'HINT' }
  | { type: 'NEXT' }
  | { type: 'END' };

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev: number[] = Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let carry = i - 1;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(
        prev[j]! + 1,
        prev[j - 1]! + 1,
        carry + cost,
      );
      carry = prev[j]!;
      prev[j] = next;
    }
  }
  return prev[b.length]!;
}

export function evaluateWriteAnswer(expected: string, guess: string): boolean {
  const a = expected.trim().toLowerCase();
  const b = guess.trim().toLowerCase();
  if (a === b) return true;
  if (a.length < 6) return false;
  return levenshtein(a, b) <= 1;
}

export const writeMachine = setup({
  types: {
    context: {} as WriteContext,
    events: {} as WriteEvent,
  },
  guards: {
    hasMoreCards: ({ context }) => context.currentIndex < context.cards.length - 1,
  },
  actions: {
    startSession: assign(({ event }) => {
      if (event.type !== 'START') return {};
      return { cards: event.cards, currentIndex: 0, correct: 0, incorrect: 0, usedHint: false };
    }),
    scoreAnswer: assign(({ context, event }) => {
      if (event.type !== 'SUBMIT') return {};
      const card = context.cards[context.currentIndex];
      if (!card) return {};
      const correct = evaluateWriteAnswer(card.answer, event.guess);
      return {
        correct: correct ? context.correct + 1 : context.correct,
        incorrect: correct ? context.incorrect : context.incorrect + 1,
      };
    }),
    useHint: assign({ usedHint: true }),
    advance: assign(({ context }) => ({
      currentIndex: context.currentIndex + 1,
      usedHint: false,
    })),
  },
}).createMachine({
  id: 'write',
  initial: 'idle',
  context: {
    cards: [],
    currentIndex: 0,
    correct: 0,
    incorrect: 0,
    usedHint: false,
  },
  states: {
    idle: {
      on: { START: { target: 'active', actions: 'startSession' } },
    },
    active: {
      on: {
        SUBMIT: { actions: 'scoreAnswer' },
        HINT: { actions: 'useHint' },
        NEXT: [{ guard: 'hasMoreCards', actions: 'advance' }, { target: 'complete' }],
        END: 'complete',
      },
    },
    complete: {
      type: 'final',
    },
  },
});
