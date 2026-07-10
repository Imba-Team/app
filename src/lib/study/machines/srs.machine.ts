import { setup, assign } from 'xstate';

/**
 * SRS review-session machine (SRS §5.12, TDD §8).
 *
 * Wraps the SM-2 review flow: fetch queue -> present card -> record grade -> repeat.
 * The actual SM-2 interval/ease calculations run server-side (backend `srs` module);
 * the client just orchestrates the UI loop and reports grades.
 */

export type SrsGrade = 'again' | 'hard' | 'good' | 'easy';

export interface SrsQueueCard {
  cardId: string;
  term: string;
  definition: string;
  dueDate: string;
}

interface SrsContext {
  queue: SrsQueueCard[];
  reviewed: number;
  gradedAgain: number;
  gradedHard: number;
  gradedGood: number;
  gradedEasy: number;
}

type SrsEvent =
  { type: 'LOAD'; queue: SrsQueueCard[] } | { type: 'GRADE'; grade: SrsGrade } | { type: 'END' };

export const srsMachine = setup({
  types: {
    context: {} as SrsContext,
    events: {} as SrsEvent,
  },
  guards: {
    hasMoreCards: ({ context }) => context.queue.length > 1,
  },
  actions: {
    setQueue: assign(({ event }) => {
      if (event.type !== 'LOAD') return {};
      return {
        queue: event.queue,
        reviewed: 0,
        gradedAgain: 0,
        gradedHard: 0,
        gradedGood: 0,
        gradedEasy: 0,
      };
    }),
    recordGrade: assign(({ context, event }) => {
      if (event.type !== 'GRADE') return {};
      const inc = (key: keyof SrsContext) => (context[key] as number) + 1;
      return {
        reviewed: context.reviewed + 1,
        gradedAgain: event.grade === 'again' ? inc('gradedAgain') : context.gradedAgain,
        gradedHard: event.grade === 'hard' ? inc('gradedHard') : context.gradedHard,
        gradedGood: event.grade === 'good' ? inc('gradedGood') : context.gradedGood,
        gradedEasy: event.grade === 'easy' ? inc('gradedEasy') : context.gradedEasy,
        queue: context.queue.slice(1),
      };
    }),
  },
}).createMachine({
  id: 'srs',
  initial: 'loading',
  context: {
    queue: [],
    reviewed: 0,
    gradedAgain: 0,
    gradedHard: 0,
    gradedGood: 0,
    gradedEasy: 0,
  },
  states: {
    loading: {
      on: {
        LOAD: [
          {
            guard: ({ event }) => event.queue.length > 0,
            target: 'reviewing',
            actions: 'setQueue',
          },
          { target: 'empty', actions: 'setQueue' },
        ],
      },
    },
    reviewing: {
      on: {
        GRADE: [
          { guard: 'hasMoreCards', actions: 'recordGrade' },
          { target: 'complete', actions: 'recordGrade' },
        ],
        END: 'complete',
      },
    },
    empty: {
      type: 'final',
    },
    complete: {
      type: 'final',
    },
  },
});
