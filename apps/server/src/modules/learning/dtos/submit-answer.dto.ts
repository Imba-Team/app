import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { AttemptOutcome, StudyMode } from '../domain/card-attempt-event';

const STUDY_MODES: StudyMode[] = [
  'FLASHCARD',
  'LEARN_MC',
  'LEARN_WRITTEN',
  'WRITE',
  'SPELL',
  'TEST_WRITTEN',
  'TEST_MC',
  'TEST_TF',
  'AI_FILL_BLANK',
  'AI_GUESS_WORD',
  'MATCH',
];

const OUTCOMES: AttemptOutcome[] = ['CORRECT', 'INCORRECT', 'SKIPPED'];

export class SubmitAnswerDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Client-generated UUID used to make retries idempotent. Second submit with the same attemptId returns the first result without re-applying it.',
  })
  @IsUUID()
  attemptId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cardId!: string;

  @ApiProperty({ enum: STUDY_MODES })
  @IsIn(STUDY_MODES)
  studyMode!: StudyMode;

  @ApiProperty({ enum: OUTCOMES })
  @IsIn(OUTCOMES)
  outcome!: AttemptOutcome;

  @ApiProperty({ example: false })
  @IsBoolean()
  hintUsed!: boolean;

  @ApiPropertyOptional({
    description:
      'The learner-typed response for written modes. Used to echo back on the client; not stored on the mastery row.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  response?: string;

  @ApiPropertyOptional({
    description:
      'Client-measured milliseconds from card render to submit. Logged on the CardAttempt audit row for analytics and adaptive difficulty.',
    example: 4200,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  responseMs?: number;
}
