import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { SrsCardDto } from './srs-card.dto';

export class SrsReviewResponseDto {
  @ApiProperty({ type: SrsCardDto })
  @Expose()
  @Type(() => SrsCardDto)
  card!: SrsCardDto;

  @ApiProperty({
    description:
      'Number of cards still due today for the caller after this review is applied.',
  })
  @Expose()
  remainingDueToday!: number;
}
