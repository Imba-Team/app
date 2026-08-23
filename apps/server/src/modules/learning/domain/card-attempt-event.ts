export type StudyMode =
  | 'FLASHCARD'
  | 'LEARN_MC'
  | 'LEARN_WRITTEN'
  | 'WRITE'
  | 'SPELL'
  | 'TEST_WRITTEN'
  | 'TEST_MC'
  | 'TEST_TF'
  /** Matching-question pair inside a Test attempt — one CardAttempt-
   *  equivalent per pair. Recognition-difficulty (learner drags a
   *  definition onto a term), so mode-weight matches TEST_MC. */
  | 'TEST_MATCH'
  | 'AI_FILL_BLANK'
  | 'AI_GUESS_WORD';

export type AttemptOutcome = 'CORRECT' | 'INCORRECT' | 'SKIPPED';

export interface CardAttemptEvent {
  attemptId: string;
  userId: string;
  cardId: string;
  setId: string;
  sessionId: string;
  studyMode: StudyMode;
  outcome: AttemptOutcome;
  hintUsed: boolean;
  attemptedAt: Date;
  /** Client-measured time from card render to submit. Optional — older
   *  clients / non-timed flows won't send it. Persisted on CardAttempt. */
  responseMs?: number;
  /** Written-mode only: 0.000 – 1.000 similarity produced by the
   *  evaluator. Passed through to CardAttempt for analytics. */
  similarity?: number;
  /** Written-mode only: Levenshtein distance produced by the evaluator. */
  editDistance?: number;
}
