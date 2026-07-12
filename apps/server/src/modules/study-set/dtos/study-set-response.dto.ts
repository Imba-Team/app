import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

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

  @ApiProperty({ example: true, required: false })
  @Expose()
  isCollected?: boolean;

  @ApiProperty({ example: 0 })
  @Expose()
  flashcardsCount?: number;
}
