import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class AddFolderStudySetsResponseDto {
  @Expose()
  @ApiProperty({ type: [String] })
  addedStudySetIds!: string[];

  @Expose()
  @ApiProperty({ type: [String] })
  skippedStudySetIds!: string[];
}
