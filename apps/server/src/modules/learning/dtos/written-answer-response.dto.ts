import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import {
  AnswerResponseDto,
  CardProgressSummaryDto,
  SetProgressSummaryDto,
} from './answer-response.dto';

export class DiffSegmentDto {
  @ApiProperty({
    enum: ['match', 'wrong', 'missing', 'extra'],
    description:
      'match: identical in both. wrong: the input character(s) at this position differ from expected (rendered highlighted). missing: expected character(s) the learner omitted. extra: characters the learner added.',
  })
  @Expose()
  type!: 'match' | 'wrong' | 'missing' | 'extra';

  @ApiProperty({
    description:
      'Verbatim run of characters for this segment. Segments always come from the normalized forms, not the raw input.',
  })
  @Expose()
  text!: string;
}

export class WriteEvaluationDto {
  @ApiProperty({
    enum: ['EXACT', 'TYPO_ACCEPTED', 'WRONG'],
    description:
      'EXACT = normalized strings match (or token-set match for multi-word answers). TYPO_ACCEPTED = Levenshtein distance ≤ 1 in a 6+ character answer (still scored CORRECT). WRONG = anything else.',
  })
  @Expose()
  matchType!: 'EXACT' | 'TYPO_ACCEPTED' | 'WRONG';

  @ApiProperty({
    description:
      '0.00–1.00. Computed as 1 - editDistance / max(len). Frontend can render a "you were close" screen using this even when the outcome is INCORRECT.',
    example: 0.92,
  })
  @Expose()
  similarity!: number;

  @ApiProperty({
    description: 'Levenshtein distance between the normalized strings.',
  })
  @Expose()
  editDistance!: number;

  @ApiProperty({
    description:
      "The learner's answer after normalization. Useful for client-side diff rendering.",
  })
  @Expose()
  normalizedInput!: string;

  @ApiProperty({ description: 'The canonical answer after normalization.' })
  @Expose()
  normalizedExpected!: string;

  @ApiProperty({
    description:
      'Raw text of the candidate that produced the best score — either the primary card definition or one of the author-provided alternate answers.',
  })
  @Expose()
  matchedAgainst!: string;

  @ApiProperty({
    type: [DiffSegmentDto],
    description:
      'Character-level diff of the normalized input against the matched candidate. Rendered directly by the UI feedback panel.',
  })
  @Expose()
  @Type(() => DiffSegmentDto)
  diff!: DiffSegmentDto[];
}

export class WrittenAnswerResponseDto {
  @ApiProperty()
  @Expose()
  correct!: boolean;

  @ApiProperty({ description: 'Canonical answer text for the card.' })
  @Expose()
  correctAnswer!: string;

  @ApiProperty()
  @Expose()
  graduated!: boolean;

  @ApiProperty()
  @Expose()
  demoted!: boolean;

  @ApiProperty({ type: CardProgressSummaryDto })
  @Expose()
  @Type(() => CardProgressSummaryDto)
  cardProgress!: CardProgressSummaryDto;

  @ApiProperty({ type: SetProgressSummaryDto })
  @Expose()
  @Type(() => SetProgressSummaryDto)
  setProgress!: SetProgressSummaryDto;

  @ApiProperty({ type: WriteEvaluationDto })
  @Expose()
  @Type(() => WriteEvaluationDto)
  evaluation!: WriteEvaluationDto;
}

export type AnswerResponseShape = Omit<AnswerResponseDto, never>;
