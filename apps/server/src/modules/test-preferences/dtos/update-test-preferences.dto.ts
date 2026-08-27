import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  LearnAnswerDirection,
  StudyStrictness,
  TestQuestionType,
} from '@prisma/client';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateTestPreferencesDto {
  @ApiPropertyOptional({ minimum: 5, maximum: 50, example: 20 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(50)
  questionCount?: number;

  @ApiPropertyOptional({
    enum: TestQuestionType,
    isArray: true,
    description:
      'Must be non-empty. Duplicates are rejected — pass each type at most once.',
    example: ['TEST_MC', 'TEST_WRITTEN'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(TestQuestionType, { each: true })
  allowedTypes?: TestQuestionType[];

  @ApiPropertyOptional({
    enum: LearnAnswerDirection,
    example: 'TERM_TO_DEFINITION',
  })
  @IsOptional()
  @IsEnum(LearnAnswerDirection)
  answerDirection?: LearnAnswerDirection;

  @ApiPropertyOptional({ enum: StudyStrictness, example: 'NORMAL' })
  @IsOptional()
  @IsEnum(StudyStrictness)
  strictness?: StudyStrictness;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  starredOnly?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  shuffleEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  showResultsPerQuestion?: boolean;

  @ApiPropertyOptional({ minimum: 4, maximum: 8, example: 5 })
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(8)
  matchingPairCount?: number;
}
