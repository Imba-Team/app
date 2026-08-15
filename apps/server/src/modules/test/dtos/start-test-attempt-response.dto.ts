import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { TestQuestionDto } from './test-question.dto';

export class StartTestAttemptResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  attemptId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  studySetId!: string;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty({
    description:
      "The learner-configured target from UserTestPreferences at start time. Diverges from totalQuestions when the pool couldn't fill.",
    example: 20,
  })
  @Expose()
  questionCount!: number;

  @ApiProperty({
    description:
      'Sum of scoring slots — matching contributes matchingPairCount, others 1. What the score math uses as the denominator.',
    example: 12,
  })
  @Expose()
  totalQuestions!: number;

  @ApiProperty({
    type: [TestQuestionDto],
    description:
      'Server-generated questions in order. Correct answers are NOT included; the server grades on submit.',
  })
  @Expose()
  @Type(() => TestQuestionDto)
  questions!: TestQuestionDto[];

  @ApiProperty({
    description:
      'True when the caller already had an IN_PROGRESS attempt for this set and the server returned it instead of creating a new one.',
    example: false,
  })
  @Expose()
  resumed!: boolean;
}
