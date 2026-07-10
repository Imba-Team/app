import { setup, assign } from 'xstate';

/**
 * Learn Mode state machine (SRS §5.6, TDD §11.3).
 *
 * Placeholder — the concrete question-mixing logic (multiple-choice vs. written,
 * batch sizing 7–10, confidence-based re-injection) lands feature-by-feature.
 * The machine's shape is fixed here so screens can subscribe today.
 */

export interface LearnCardRef {
  cardId: string;
  term: string;
  definition: string;
}

interface LearnContext {
  cards: LearnCardRef[];
  currentIndex: number;
  correct: number;
  incorrect: number;
  sessionId: string | null;
}

type LearnEvent =
  | { type: 'START'; cards: LearnCardRef[]; sessionId: string }
  | { type: 'ANSWER'; correct: boolean }
  | { type: 'NEXT' }
  | { type: 'RESUME'; snapshot: LearnContext }
  | { type: 'END' };

export const learnMachine = setup({
  types: {
    context: {} as LearnContext,
    events: {} as LearnEvent,
  },
  guards: {
    hasMoreCards: ({ context }) => context.currentIndex < context.cards.length - 1,
  },
  actions: {
    startSession: assign(({ event }) => {
      if (event.type !== 'START') return {};
      return {
        cards: event.cards,
        sessionId: event.sessionId,
        currentIndex: 0,
        correct: 0,
        incorrect: 0,
      };
    }),
    recordAnswer: assign(({ context, event }) => {
      if (event.type !== 'ANSWER') return {};
      return {
        correct: event.correct ? context.correct + 1 : context.correct,
        incorrect: event.correct ? context.incorrect : context.incorrect + 1,
      };
    }),
    advance: assign(({ context }) => ({ currentIndex: context.currentIndex + 1 })),
  },
}).createMachine({
  id: 'learn',
  initial: 'idle',
  context: {
    cards: [],
    currentIndex: 0,
    correct: 0,
    incorrect: 0,
    sessionId: null,
  },
  states: {
    idle: {
      on: {
        START: { target: 'active', actions: 'startSession' },
        RESUME: {
          target: 'active',
          actions: assign(({ event }) => (event.type === 'RESUME' ? event.snapshot : {})),
        },
      },
    },
    active: {
      on: {
        ANSWER: { actions: 'recordAnswer' },
        NEXT: [{ guard: 'hasMoreCards', actions: 'advance' }, { target: 'complete' }],
        END: 'complete',
      },
    },
    complete: {
      type: 'final',
    },
  },
});
