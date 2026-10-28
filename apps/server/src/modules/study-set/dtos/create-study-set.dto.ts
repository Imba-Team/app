import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { textLimits } from 'src/common/text/text-limits';

export class CreateStudySetDto {
  @ApiProperty({ example: 'Advanced Biology', maxLength: textLimits.setTitle })
  @IsString()
  @IsNotEmpty()
  @MaxLength(textLimits.setTitle)
  title!: string;

  @ApiProperty({
    example: 'Notes and flashcards for bio exams',
    required: false,
    maxLength: textLimits.setDescription,
  })
  @IsString()
  @IsOptional()
  @MaxLength(textLimits.setDescription)
  description?: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'German',
    required: false,
    maxLength: textLimits.language,
    description: 'Trimmed on save; empty string or null clears it.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(textLimits.language)
  language?: string | null;

  @ApiProperty({
    type: [String],
    required: false,
    example: ['biology', 'exam prep'],
    maxItems: textLimits.maxTags,
    description:
      "The set's complete tag list. On update it replaces the current tags; omit it to leave them unchanged. Names are matched case-insensitively and created on first use.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(textLimits.maxTags)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(textLimits.tagName, { each: true })
  tags?: string[];

  @ApiProperty({
    example: false,
    required: false,
    description: 'true = private, false = public',
  })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}
