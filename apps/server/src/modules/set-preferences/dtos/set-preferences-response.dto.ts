import { ApiProperty } from '@nestjs/swagger';
import { LearnAnswerDirection, StudyStrictness } from '@prisma/client';
import { Expose } from 'class-transformer';

export class SetPreferencesResponseDto {
  @ApiProperty({
    description:
      'Cards per Learn batch. Range 1–50; the batch algorithm caps at this value.',
    example: 10,
  })
  @Expose()
  batchSize!: number;

  @ApiProperty({
    description:
      'Multiplier on the weighted-streak threshold that flips a card from LEARN_MC (recognition) to LEARN_WRITTEN (recall). Higher = written triggers sooner. 0 keeps a card on MC until mastery.',
    example: 1,
  })
  @Expose()
  mcWrittenBias!: number;

  @ApiProperty({
    description:
      'Weighted-streak needed for a card to graduate to MASTERED. Range 1.0–10.0.',
    example: 3,
  })
  @Expose()
  masteryThreshold!: number;

  @ApiProperty({
    description:
      'Credit multiplier applied when the learner used the hint. Range 0.0–1.0.',
    example: 0.5,
  })
  @Expose()
  hintMultiplier!: number;

  @ApiProperty({
    description:
      'Whether the client auto-advances past the feedback screen after an answer.',
    example: true,
  })
  @Expose()
  autoAdvance!: boolean;

  @ApiProperty({
    description: 'Milliseconds to hold the feedback panel when auto-advancing.',
    example: 1400,
  })
  @Expose()
  autoAdvanceMs!: number;

  @ApiProperty({
    description: 'Whether card audio (TTS) is enabled. Placeholder for now.',
    example: false,
  })
  @Expose()
  audioEnabled!: boolean;

  @ApiProperty({
    description:
      'Restrict the batch to cards the learner has starred. Empty starred pool triggers a UI empty state.',
    example: false,
  })
  @Expose()
  starredOnly!: boolean;

  @ApiProperty({
    description:
      'False = deterministic order by Flashcard.orderIndex. True = current behaviour (LEARNING first, shuffled within groups).',
    example: true,
  })
  @Expose()
  shuffleEnabled!: boolean;

  @ApiProperty({
    enum: StudyStrictness,
    description:
      'Written-answer evaluator leniency. STRICT = literal after case-insensitive + trim. NORMAL = current defaults. LENIENT = NORMAL + wider typo tolerance.',
  })
  @Expose()
  strictness!: StudyStrictness;

  @ApiProperty({
    enum: LearnAnswerDirection,
    description:
      'Which side the learner types. TERM_TO_DEFINITION: prompt = term, expected = definition (default). DEFINITION_TO_TERM: prompt = definition, expected = term (alternates ignored).',
  })
  @Expose()
  answerDirection!: LearnAnswerDirection;
}
