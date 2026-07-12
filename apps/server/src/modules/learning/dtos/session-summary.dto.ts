import { ApiProperty } from '@nestjs/swagger';
import { StudySessionMode } from '@prisma/client';
import { Expose } from 'class-transformer';

export class SessionSummaryDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  sessionId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  studySetId!: string;

  @ApiProperty({ enum: StudySessionMode })
  @Expose()
  mode!: StudySessionMode;

  @ApiProperty()
  @Expose()
  cardsStudied!: number;

  @ApiProperty()
  @Expose()
  correctAnswers!: number;

  @ApiProperty()
  @Expose()
  incorrectAnswers!: number;

  @ApiProperty({
    description:
      'Total wall-clock time in seconds from startedAt to completedAt.',
  })
  @Expose()
  durationSeconds!: number;

  @ApiProperty({
    description:
      'Accuracy as a fraction (0.00–1.00). Zero if no correct+incorrect answers recorded.',
    example: 0.85,
  })
  @Expose()
  accuracy!: number;

  @ApiProperty()
  @Expose()
  startedAt!: Date;

  @ApiProperty()
  @Expose()
  completedAt!: Date;
}
