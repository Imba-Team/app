import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { TagListItemDto } from 'src/modules/tag/dto/tag-list-item.dto';

export class StudySetResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  slug: string;

  @ApiProperty()
  @Expose()
  title: string;

  @ApiProperty()
  @Expose()
  description: string;

  @ApiProperty({ description: 'true = private, false = public' })
  @Expose()
  isPrivate: boolean;

  @ApiProperty({ type: String, nullable: true, example: 'German' })
  @Expose()
  language: string | null;

  @ApiProperty({
    type: [TagListItemDto],
    description: 'Tags on the set, sorted by name.',
  })
  @Expose()
  @Type(() => TagListItemDto)
  tags: TagListItemDto[];

  @ApiProperty({ description: 'Owner id' })
  @Expose()
  ownerId: string;

  @ApiProperty({ required: false })
  @Expose()
  ownerName?: string;

  @ApiProperty({ required: false })
  @Expose()
  ownerImg?: string;

  @ApiProperty({ example: false })
  @Expose()
  isOwner: boolean;

  @ApiProperty({
    example: false,
    description:
      'The caller may edit the set: owner or EDITOR collaborator. Visibility and deletion stay owner-only.',
  })
  @Expose()
  canEdit: boolean;

  @ApiProperty({ example: true, required: false })
  @Expose()
  isCollected?: boolean;

  @ApiProperty({ example: 0 })
  @Expose()
  flashcardsCount?: number;

  @ApiProperty({
    example: 0,
    description: 'Total non-owner views of this set.',
  })
  @Expose()
  viewCount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt: Date;
}
