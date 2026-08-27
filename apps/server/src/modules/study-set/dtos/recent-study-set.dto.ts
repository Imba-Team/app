import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { StudySetResponseDto } from './study-set-response.dto';

export class StudySetProgressDto {
  @ApiProperty({ example: 20 })
  @Expose()
  totalCards!: number;

  @ApiProperty({ example: 8 })
  @Expose()
  newCount!: number;

  @ApiProperty({ example: 7 })
  @Expose()
  learningCount!: number;

  @ApiProperty({ example: 5 })
  @Expose()
  masteredCount!: number;
}

export class RecentStudySetDto extends StudySetResponseDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Last time the caller opened a study session for this set. Null if they have never studied it (owned/favourited but untouched).',
  })
  @Expose()
  lastStudiedAt!: Date | null;

  @ApiPropertyOptional({
    type: StudySetProgressDto,
    nullable: true,
    description:
      'Per-user mastery breakdown, sourced from UserSetProgress. Null if no session has ever been started for this set.',
  })
  @Expose()
  progress!: StudySetProgressDto | null;
}
