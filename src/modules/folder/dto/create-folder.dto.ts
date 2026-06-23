import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({ example: 'Backend Revision' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    required: false,
    example: 'Study sets for backend interview prep',
  })
  @IsString()
  @IsOptional()
  @MaxLength(400)
  description?: string;
}
