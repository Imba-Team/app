import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFlashcardDto {
  @ApiProperty({ example: 'Photosynthesis' })
  @IsString()
  @IsNotEmpty()
  term!: string;

  @ApiProperty({
    example: 'The process by which green plants convert sunlight into energy.',
  })
  @IsString()
  @IsNotEmpty()
  definition!: string;

  @ApiPropertyOptional({
    example: 'Photosynthesis powers most life on Earth.',
  })
  @IsString()
  @IsOptional()
  example?: string;

  @ApiPropertyOptional({ example: '/ˌfoʊtəˈsɪnθəsɪs/' })
  @IsString()
  @IsOptional()
  phonetic?: string;

  @ApiPropertyOptional({ example: 'Starts with "photo-"' })
  @IsString()
  @IsOptional()
  hint?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.mimir.app/cards/abc.jpg',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Position within the set. Auto-assigned if omitted.',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Extra accepted answers for the written evaluator (author-provided synonyms or variants). The primary `definition` is always accepted; these are additional matches that all count as CORRECT.',
    example: ['the powerhouse of the cell', 'cell powerhouse'],
    maxItems: 25,
  })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @ArrayMaxSize(25)
  @IsOptional()
  alternateAnswers?: string[];
}
