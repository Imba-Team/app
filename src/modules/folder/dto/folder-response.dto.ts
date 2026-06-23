import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { FolderStudySetItemDto } from './folder-study-set-item.dto';

export class FolderResponseDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty()
  name!: string;

  @Expose()
  @ApiProperty({ required: false })
  description?: string | null;

  @Expose()
  @ApiProperty()
  userId!: string;

  @Expose()
  @ApiProperty()
  createdAt!: Date;

  @Expose()
  @ApiProperty()
  updatedAt!: Date;

  @Expose()
  @Type(() => FolderStudySetItemDto)
  @ApiProperty({ type: [FolderStudySetItemDto], required: false })
  studySets?: FolderStudySetItemDto[];
}
