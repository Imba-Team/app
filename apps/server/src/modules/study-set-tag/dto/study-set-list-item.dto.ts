import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class StudySetListItemDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty()
  slug!: string;

  @Expose()
  @ApiProperty()
  title!: string;

  @Expose()
  @ApiProperty({ required: false })
  description?: string | null;

  @Expose()
  @ApiProperty({ description: 'true = private, false = public' })
  isPrivate!: boolean;

  @Expose()
  @ApiProperty({ description: 'Owner id' })
  ownerId!: string;
}
