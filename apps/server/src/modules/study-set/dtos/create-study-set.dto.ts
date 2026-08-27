import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStudySetDto {
  @ApiProperty({ example: 'Advanced Biology' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example: 'Notes and flashcards for bio exams',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'German',
    required: false,
  })
  @IsString()
  @IsOptional()
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
