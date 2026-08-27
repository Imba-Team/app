import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class FlashcardResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  studySetId!: string;

  @ApiProperty()
  @Expose()
  term!: string;

  @ApiProperty()
  @Expose()
  definition!: string;

  @ApiProperty({
    type: [String],
    description:
      'Extra accepted answers for the written evaluator. Empty when the author has not provided synonyms/variants.',
    example: [],
  })
  @Expose()
  alternateAnswers!: string[];

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  example?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  phonetic?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  hint?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  imageUrl?: string | null;

  @ApiProperty()
  @Expose()
  orderIndex!: number;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
