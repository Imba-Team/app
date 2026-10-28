import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { textLimits } from 'src/common/text/text-limits';

export class SuggestTagsQueryDto {
  @ApiPropertyOptional({
    example: 'bio',
    description:
      'Text to match against tag names. Omit for the most popular tags.',
    maxLength: textLimits.tagName,
  })
  @IsOptional()
  @IsString()
  @MaxLength(textLimits.tagName)
  q?: string;

  @ApiPropertyOptional({ example: 8, minimum: 1, maximum: 20, default: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
