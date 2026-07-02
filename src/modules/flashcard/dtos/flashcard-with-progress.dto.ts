import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardMasteryStatus } from '@prisma/client';
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

  @ApiProperty({ enum: CardMasteryStatus })
  @Expose()
  status!: CardMasteryStatus;

  @ApiProperty({
    example: '1.50',
    description: 'Running weighted-correct streak (0.00 – 5.00+).',
  })
  @Expose()
  weightedStreak!: string;

  @ApiProperty({ example: false })
  @Expose()
  isStarred!: boolean;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-30T21:04:11.000Z' })
  @Expose()
  masteredAt!: Date | null;
}
