import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LearnAnswerDirection,
  TestAttemptStatus,
  TestQuestionType,
} from '@prisma/client';
import { Expose, Type } from 'class-transformer';

/**
 * One graded pair inside a matching question. `flashcardId` is the
 * correct anchor; `userMatchedFlashcardId` is what the learner
 * actually dropped (null when blank).
 */
export class TestPairResultDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  pairId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  flashcardId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @Expose()
  userMatchedFlashcardId!: string | null;

  @ApiProperty()
  @Expose()
  isCorrect!: boolean;

  @ApiProperty({
    description:
      'Prompt-side text of the anchor card (the fixed left-column value under the resolved direction).',
  })
  @Expose()
  anchorText!: string;

  @ApiProperty({
    description:
      'Answer-side text of the anchor card — the correct match for this anchor.',
  })
  @Expose()
  correctText!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Answer-side text of the card the learner dropped on this anchor. Null when they left it blank.',
  })
  @Expose()
  userAnswerText!: string | null;
}

/**
 * Per-question review row. Everything the learner needs to see on the
 * results screen: what they were asked, what they answered, what was
 * correct, and whether they got it right.
 */
export class TestQuestionResultDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  questionAttemptId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  flashcardId!: string;

  @ApiProperty({ enum: TestQuestionType })
  @Expose()
  questionType!: TestQuestionType;

  @ApiProperty({ enum: LearnAnswerDirection })
  @Expose()
  answerDirection!: LearnAnswerDirection;

  @ApiProperty()
  @Expose()
  promptText!: string;

  @ApiProperty()
  @Expose()
  expectedAnswer!: string;

  @ApiPropertyOptional({ type: [String] })
  @Expose()
  choices!: string[];

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  correctChoiceIndex!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  userAnswer!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  selectedChoiceIndex!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Written-mode similarity (0.000–1.000). Null for other types.',
  })
  @Expose()
  similarity!: number | null;

  @ApiProperty()
  @Expose()
  isCorrect!: boolean;

  @ApiProperty({ description: '1-indexed position within the test.' })
  @Expose()
  orderIndex!: number;

  @ApiPropertyOptional({
    type: [TestPairResultDto],
    description: 'MATCH only — per-pair judgments.',
  })
  @Expose()
  @Type(() => TestPairResultDto)
  pairs?: TestPairResultDto[];
}

/**
 * Full attempt result. Returned from both the submit endpoint (fresh
 * grading) and the get-attempt endpoint (review of a past attempt).
 */
export class TestAttemptResultDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  attemptId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  studySetId!: string;

  @ApiProperty({ enum: TestAttemptStatus })
  @Expose()
  status!: TestAttemptStatus;

  @ApiProperty({ description: 'Percentage score (0.00–100.00).', example: 85 })
  @Expose()
  score!: number;

  @ApiProperty({ description: 'Sum of scoring slots.' })
  @Expose()
  totalQuestions!: number;

  @ApiProperty()
  @Expose()
  correctCount!: number;

  @ApiProperty()
  @Expose()
  incorrectCount!: number;

  @ApiProperty()
  @Expose()
  questionCount!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  durationSeconds!: number | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  submittedAt!: Date | null;

  @ApiProperty({ type: [TestQuestionResultDto] })
  @Expose()
  @Type(() => TestQuestionResultDto)
  questions!: TestQuestionResultDto[];
}
