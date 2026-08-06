import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SearchFlashcardsQueryDto {
  @ApiProperty({
    description: 'Query string. Matches term or definition (case-insensitive).',
    example: 'photosynthesis',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({
    description:
      'Restrict the search to a single study set the caller can access. ' +
      'Omit to search across every set the caller owns or collaborates on.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  setId?: string;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;
}

export class FlashcardSearchHitDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  term: string;

  @ApiProperty()
  definition: string;

  @ApiProperty()
  studySetId: string;

  @ApiProperty()
  studySetTitle: string;
}

export class FlashcardSearchResponseDto {
  @ApiProperty({ type: [FlashcardSearchHitDto] })
  items: FlashcardSearchHitDto[];

  @ApiProperty()
  total: number;
}
