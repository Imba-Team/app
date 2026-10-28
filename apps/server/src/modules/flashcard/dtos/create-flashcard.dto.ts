import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { assetRefPattern, textLimits } from 'src/common/text/text-limits';

export class CreateFlashcardDto {
  @ApiProperty({ example: 'Photosynthesis', maxLength: textLimits.cardTerm })
  @IsString()
  @IsNotEmpty()
  @MaxLength(textLimits.cardTerm)
  term!: string;

  @ApiProperty({
    example: 'The process by which green plants convert sunlight into energy.',
    maxLength: textLimits.cardDefinition,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(textLimits.cardDefinition)
  definition!: string;

  @ApiPropertyOptional({
    example: 'Photosynthesis powers most life on Earth.',
    maxLength: textLimits.cardExample,
  })
  @IsString()
  @IsOptional()
  @MaxLength(textLimits.cardExample)
  example?: string;

  @ApiPropertyOptional({
    example: '/ˌfoʊtəˈsɪnθəsɪs/',
    maxLength: textLimits.cardPhonetic,
  })
  @IsString()
  @IsOptional()
  @MaxLength(textLimits.cardPhonetic)
  phonetic?: string;

  @ApiPropertyOptional({
    example: 'Starts with "photo-"',
    maxLength: textLimits.cardHint,
  })
  @IsString()
  @IsOptional()
  @MaxLength(textLimits.cardHint)
  hint?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.mimir.app/cards/abc.jpg',
    description: 'An absolute http(s) URL or a storage object name.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(textLimits.assetRef)
  @Matches(assetRefPattern, {
    message: 'imageUrl must be an http(s) URL or a storage object name',
  })
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
