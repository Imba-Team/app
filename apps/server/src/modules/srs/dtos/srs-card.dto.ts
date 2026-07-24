import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class SrsCardDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  cardId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  studySetId!: string;

  @ApiProperty()
  @Expose()
  term!: string;

  @ApiProperty()
  @Expose()
  definition!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  hint!: string | null;

  @ApiProperty({ example: '2.50' })
  @Expose()
  easeFactor!: string;

  @ApiProperty()
  @Expose()
  intervalDays!: number;

  @ApiProperty()
  @Expose()
  repetitions!: number;

  @ApiProperty()
  @Expose()
  lapses!: number;

  @ApiProperty({ format: 'date' })
  @Expose()
  dueDate!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  lastReviewed!: Date | null;

  @ApiProperty()
  @Expose()
  isLeech!: boolean;
}
