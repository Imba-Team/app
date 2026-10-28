import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
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
    example: 'German',
    required: false,
    maxLength: textLimits.language,
  })
  @IsString()
  @IsOptional()
  @MaxLength(textLimits.language)
  language?: string;

  @ApiProperty({
    example: false,
    required: false,
    description: 'true = private, false = public',
  })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}
