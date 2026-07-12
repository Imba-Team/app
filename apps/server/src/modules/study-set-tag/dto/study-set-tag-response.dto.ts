import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class StudySetTagResponseDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty()
  studySetId!: string;

  @Expose()
  @ApiProperty()
  tagId!: string;
}
