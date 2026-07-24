import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

import { Sm2Rating } from '../domain/sm2';

const RATINGS: Sm2Rating[] = ['AGAIN', 'HARD', 'GOOD', 'EASY'];

export class ReviewSrsCardDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Client-generated UUID used to make retries idempotent. Second submit with the same attemptId returns the first result without re-applying it.',
  })
  @IsUUID()
  attemptId!: string;

  @ApiProperty({ enum: RATINGS })
  @IsIn(RATINGS)
  rating!: Sm2Rating;
}
