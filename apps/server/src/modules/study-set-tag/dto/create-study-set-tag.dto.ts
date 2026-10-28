import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { textLimits } from 'src/common/text/text-limits';

export class CreateStudySetTagDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  studySetId!: string;

  // Same bounds as CreateTagDto.name — this route creates the tag if it
  // doesn't exist yet, so it must not be a way around them.
  @ApiProperty({ example: 'JavaScript', maxLength: textLimits.tagName })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(textLimits.tagName)
  tagName!: string;
}
