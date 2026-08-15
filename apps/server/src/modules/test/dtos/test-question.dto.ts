import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LearnAnswerDirection, TestQuestionType } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

/**
 * One pair inside a matching question, presented to the client so it
 * can render the anchors (left column) and candidates (right column)
 * independently. `pairId` matches the persisted TestMatchingPair row
 * so the client can echo it back on submit.
 */
export class TestMatchingPairDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  pairId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The card whose term is the anchor for this pair. Clients use this to score matching client-side for preview but the server is the source of truth.',
  })
  @Expose()
  flashcardId!: string;

  @ApiProperty({
    description:
      'Anchor text — the term (or definition, under reverse direction) shown on the left column.',
  })
  @Expose()
  anchorText!: string;

  @ApiProperty({
    description:
      'Candidate text — the definition (or term) that should be dragged onto the anchor. Server shuffles the candidate order independently so the correct match is not always at the same row as its anchor.',
  })
  @Expose()
  candidateText!: string;
}

export class TestQuestionDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'ID of the persisted TestQuestionAttempt row. Clients echo this back on submit to identify which answer maps to which question.',
  })
  @Expose()
  questionAttemptId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  flashcardId!: string;

  @ApiProperty({ enum: TestQuestionType })
  @Expose()
  questionType!: TestQuestionType;

  @ApiProperty({
    enum: LearnAnswerDirection,
    description:
      'Resolved direction for this specific question. Always TERM_TO_DEFINITION or DEFINITION_TO_TERM — MIXED is a preference, not a per-question value.',
  })
  @Expose()
  answerDirection!: LearnAnswerDirection;

  @ApiProperty({
    description:
      'The prompt text — the term (or definition, under reverse) for MC/WRITTEN, the term for TF, and a header string for MATCH.',
  })
  @Expose()
  promptText!: string;

  @ApiProperty({ description: '1-indexed position within the test.' })
  @Expose()
  orderIndex!: number;

  @ApiPropertyOptional({
    type: [String],
    description:
      'MC only — 4 shuffled options. Empty for other types. Never includes the correct index (client must submit its selection).',
  })
  @Expose()
  choices?: string[];

  @ApiPropertyOptional({
    description:
      'TF only — the candidate definition (or term) presented alongside the prompt. Learner presses True/False.',
  })
  @Expose()
  tfPresentedAnswer?: string;

  @ApiPropertyOptional({
    type: [TestMatchingPairDto],
    description:
      'MATCH only — one entry per pair. anchorText + candidateText are shuffled independently so pairing is meaningful.',
  })
  @Expose()
  @Type(() => TestMatchingPairDto)
  matchingPairs?: TestMatchingPairDto[];
}
