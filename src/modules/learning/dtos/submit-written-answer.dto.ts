import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import { StudyMode } from '../domain/card-attempt-event';

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
}
