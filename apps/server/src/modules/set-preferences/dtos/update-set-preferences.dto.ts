import { ApiPropertyOptional } from '@nestjs/swagger';
import { LearnAnswerDirection, StudyStrictness } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateSetPreferencesDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  batchSize?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 5, example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  mcWrittenBias?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  masteryThreshold?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, example: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  hintMultiplier?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoAdvance?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 10000, example: 1400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  autoAdvanceMs?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  audioEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  starredOnly?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  shuffleEnabled?: boolean;

  @ApiPropertyOptional({ enum: StudyStrictness, example: 'NORMAL' })
  @IsOptional()
  @IsEnum(StudyStrictness)
  strictness?: StudyStrictness;

  @ApiPropertyOptional({
    enum: LearnAnswerDirection,
    example: 'TERM_TO_DEFINITION',
  })
  @IsOptional()
  @IsEnum(LearnAnswerDirection)
  answerDirection?: LearnAnswerDirection;
}
