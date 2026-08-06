import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchSetsQueryDto {
  @ApiPropertyOptional({ example: 'photosynthesis' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ example: 'English' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({
    example: 'biology',
    description:
      'Exact-match tag filter. Matches the tag name as stored on the ' +
      'set (case-sensitive, keyword field on the ES side).',
  })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({
    example: 1,
    description: '1-based page index.',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Page size.',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;
}
