export type StudyMode =
  | 'FLASHCARD'
  | 'LEARN_MC'
  | 'LEARN_WRITTEN'
  | 'WRITE'
  | 'SPELL'
  | 'TEST_WRITTEN'
  | 'TEST_MC'
  | 'TEST_TF'
  | 'AI_FILL_BLANK'
  | 'AI_GUESS_WORD'
  | 'MATCH';

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
}
