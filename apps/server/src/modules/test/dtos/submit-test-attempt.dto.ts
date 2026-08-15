import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SubmitTestMatchingPickDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  pairId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Which flashcard the learner dropped on this pair. Null when they left it blank.',
  })
  @IsOptional()
  @IsUUID()
  userMatchedFlashcardId?: string | null;
}

export class SubmitTestQuestionAnswerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionAttemptId!: string;

  @ApiPropertyOptional({
    description: 'WRITTEN — verbatim learner input.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAnswer?: string;

  @ApiPropertyOptional({
    description: "MC — index into the question's choices.",
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  selectedChoiceIndex?: number;

  @ApiPropertyOptional({
    description:
      'TF — true if the learner said the presented pairing is correct.',
  })
  @IsOptional()
  @IsBoolean()
  userIsTrue?: boolean;

  @ApiPropertyOptional({
    type: [SubmitTestMatchingPickDto],
    description:
      'MATCH — one entry per pair. Missing entries count as unanswered (incorrect).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitTestMatchingPickDto)
  matchingPicks?: SubmitTestMatchingPickDto[];
}

export class SubmitTestAttemptDto {
  @ApiProperty({
    type: [SubmitTestQuestionAnswerDto],
    description:
      'One entry per question in the attempt. Missing entries count as unanswered (incorrect). Order does not matter — questions are matched by questionAttemptId.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitTestQuestionAnswerDto)
  answers!: SubmitTestQuestionAnswerDto[];
}
