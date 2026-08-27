import { StudySessionMode } from '@prisma/client';
import { StudyMode } from './card-attempt-event';

export function granularToCoarse(mode: StudyMode): StudySessionMode {
  switch (mode) {
    case 'LEARN_MC':
    case 'LEARN_WRITTEN':
      return StudySessionMode.LEARN;
    case 'TEST_WRITTEN':
    case 'TEST_MC':
    case 'TEST_TF':
    case 'TEST_MATCH':
      return StudySessionMode.TEST;
    case 'FLASHCARD':
      return StudySessionMode.FLASHCARD;
    case 'WRITE':
      return StudySessionMode.WRITE;
    case 'SPELL':
      return StudySessionMode.SPELL;
    case 'AI_FILL_BLANK':
      return StudySessionMode.AI_FILL_BLANK;
    case 'AI_GUESS_WORD':
      return StudySessionMode.AI_GUESS_WORD;
  }
}
