import { ApiProperty } from '@nestjs/swagger';
import {
  LearnAnswerDirection,
  StudyStrictness,
  TestQuestionType,
} from '@prisma/client';
import { Expose } from 'class-transformer';

export class TestPreferencesResponseDto {
  @ApiProperty({
    description:
      'Target scoring slots per attempt. 5–50. A matching question consumes `matchingPairCount` of these; the rest are single-card questions.',
    example: 20,
  })
  @Expose()
  questionCount!: number;

  @ApiProperty({
    enum: TestQuestionType,
    isArray: true,
    description:
      'Question types the generator may pick from. Empty is not allowed — the frontend forces at least one selection.',
    example: ['TEST_MC', 'TEST_WRITTEN', 'TEST_TF', 'TEST_MATCH'],
  })
  @Expose()
  allowedTypes!: TestQuestionType[];

  @ApiProperty({
    enum: LearnAnswerDirection,
    description:
      'Which side the learner produces. MIXED rolls a direction per card at generation time.',
  })
  @Expose()
  answerDirection!: LearnAnswerDirection;

  @ApiProperty({
    enum: StudyStrictness,
    description:
      'Written-answer evaluator leniency, same tiers as Learn Mode. STRICT is a natural default for tests but NORMAL matches Learn for parity.',
  })
  @Expose()
  strictness!: StudyStrictness;

  @ApiProperty({
    description: 'Restrict the pool to starred cards only.',
    example: false,
  })
  @Expose()
  starredOnly!: boolean;

  @ApiProperty({
    description:
      'When true, shuffle the pool before generating questions. When false, follow Flashcard.orderIndex.',
    example: true,
  })
  @Expose()
  shuffleEnabled!: boolean;

  @ApiProperty({
    description:
      'Reveal correctness after each question (true) or only on the results screen (false — closer to a real test).',
    example: false,
  })
  @Expose()
  showResultsPerQuestion!: boolean;

  @ApiProperty({
    description:
      'Pair count for a matching question. Only meaningful when TEST_MATCH is in allowedTypes; also the number of scoring slots the matching question consumes.',
    example: 5,
  })
  @Expose()
  matchingPairCount!: number;
}
