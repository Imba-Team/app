import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';

export class SessionTotalsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional — restrict totals to sessions on this study set. Omit for all of the user’s sessions.',
  })
  @IsOptional()
  @IsUUID()
  studySetId?: string;
}

/** All-time roll-up of the sessions `GET /sessions` would list. */
export class SessionTotalsDto {
  @ApiProperty()
  @Expose()
  totalSessions!: number;

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
    type: Number,
    nullable: true,
    description: 'correct / (correct + incorrect), 0–1; null with no answers.',
  })
  @Expose()
  accuracy!: number | null;

  @ApiProperty({ description: 'Summed duration of completed sessions.' })
  @Expose()
  durationSeconds!: number;
}
