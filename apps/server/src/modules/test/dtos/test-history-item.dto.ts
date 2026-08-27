import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestAttemptStatus } from '@prisma/client';
import { Expose } from 'class-transformer';

/**
 * List-row shape for the history page. Doesn't include per-question
 * detail — clients that want the review UI fetch a single attempt.
 */
export class TestHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  attemptId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  studySetId!: string;

  @ApiProperty({ enum: TestAttemptStatus })
  @Expose()
  status!: TestAttemptStatus;

  @ApiProperty()
  @Expose()
  score!: number;

  @ApiProperty()
  @Expose()
  totalQuestions!: number;

  @ApiProperty()
  @Expose()
  correctCount!: number;

  @ApiProperty()
  @Expose()
  incorrectCount!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  durationSeconds!: number | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  submittedAt!: Date | null;
}
