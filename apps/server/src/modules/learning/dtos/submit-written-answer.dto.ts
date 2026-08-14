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
import { StudyMode } from '../domain/card-attempt-event';
import {
  RESOLVED_ANSWER_DIRECTIONS,
  type ResolvedAnswerDirection,
} from './resolved-answer-direction';

const WRITTEN_STUDY_MODES: StudyMode[] = [
  'WRITE',
  'LEARN_WRITTEN',
  'TEST_WRITTEN',
  'AI_FILL_BLANK',
  'AI_GUESS_WORD',
];

export type WrittenStudyMode = (typeof WRITTEN_STUDY_MODES)[number];

export class SubmitWrittenAnswerDto {
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

  @ApiProperty({
    enum: WRITTEN_STUDY_MODES,
    description:
      'Which written mode produced this answer. Must be one of the recall-oriented modes; the multiple-choice / self-report modes go through POST /sessions/:id/answer directly.',
  })
  @IsIn(WRITTEN_STUDY_MODES)
  studyMode!: WrittenStudyMode;

  @ApiProperty({
    description: 'The learner-typed answer, exactly as entered.',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  userAnswer!: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  hintUsed!: boolean;

  @ApiPropertyOptional({
    description:
      'Client-measured milliseconds from card render to submit. Logged on the CardAttempt audit row for analytics and adaptive difficulty.',
    example: 6800,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  responseMs?: number;

  @ApiPropertyOptional({
    enum: RESOLVED_ANSWER_DIRECTIONS,
    description:
      'Which side of the card the learner produced — echoed from LearnBatchCardDto.answerDirection. Needed when the pref is MIXED (each card has its own direction). Omitted for legacy clients; the server falls back to the preference-level direction.',
  })
  @IsOptional()
  @IsIn(RESOLVED_ANSWER_DIRECTIONS)
  answerDirection?: ResolvedAnswerDirection;
}
