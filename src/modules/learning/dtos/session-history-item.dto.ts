import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StudySessionMode } from '@prisma/client';
import { Expose } from 'class-transformer';

export class SessionHistoryItemDto {
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

  @ApiProperty()
  @Expose()
  durationSeconds!: number;

  @ApiProperty({
    description:
      'Accuracy as a fraction (0.00–1.00). Zero if the session recorded no correct/incorrect answers yet.',
    example: 0.85,
  })
  @Expose()
  accuracy!: number;

  @ApiProperty()
  @Expose()
  startedAt!: Date;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Null while a session is still in progress.',
  })
  @Expose()
  completedAt!: Date | null;
}
