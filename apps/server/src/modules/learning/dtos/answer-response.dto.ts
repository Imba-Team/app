import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardMasteryStatus } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

export class CardProgressSummaryDto {
  @ApiProperty({ enum: CardMasteryStatus })
  @Expose()
  status!: CardMasteryStatus;

  @ApiProperty({ example: '1.50' })
  @Expose()
  weightedStreak!: string;

  @ApiProperty()
  @Expose()
  correctCount!: number;

  @ApiProperty()
  @Expose()
  incorrectCount!: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  masteredAt!: Date | null;
}

export class SetProgressSummaryDto {
  @ApiProperty()
  @Expose()
  totalCards!: number;

  @ApiProperty()
  @Expose()
  newCount!: number;

  @ApiProperty()
  @Expose()
  learningCount!: number;

  @ApiProperty()
  @Expose()
  masteredCount!: number;
}

export class AnswerResponseDto {
  @ApiProperty({
    description:
      'True if the submitted outcome was CORRECT (echoed for UI convenience).',
  })
  @Expose()
  correct!: boolean;

  @ApiProperty({ description: 'Canonical answer text for the card.' })
  @Expose()
  correctAnswer!: string;

  @ApiProperty({
    description:
      'Whether this attempt caused the card to reach MASTERED for the first time. SRS row created if true.',
  })
  @Expose()
  graduated!: boolean;

  @ApiProperty({
    description:
      'Whether this attempt demoted a previously MASTERED card back to LEARNING.',
  })
  @Expose()
  demoted!: boolean;

  @ApiProperty({ type: CardProgressSummaryDto })
  @Expose()
  @Type(() => CardProgressSummaryDto)
  cardProgress!: CardProgressSummaryDto;

  @ApiProperty({ type: SetProgressSummaryDto })
  @Expose()
  @Type(() => SetProgressSummaryDto)
  setProgress!: SetProgressSummaryDto;
}
