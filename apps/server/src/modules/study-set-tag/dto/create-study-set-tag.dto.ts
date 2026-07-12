import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateStudySetTagDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  studySetId!: string;

  @ApiProperty({ example: 'JavaScrript' })
  @IsString()
  @IsNotEmpty()
  tagName!: string;
}
