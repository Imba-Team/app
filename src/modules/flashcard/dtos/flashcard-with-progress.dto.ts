import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class FlashcardWithProgressDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  term!: string;

  @ApiProperty()
  @Expose()
  definition!: string;

  @ApiProperty({ enum: ['not_started', 'in_progress', 'completed'] })
  @Expose()
  status!: 'not_started' | 'in_progress' | 'completed';

  @ApiProperty({ example: false })
  @Expose()
  isStarred!: boolean;
}
