import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class TagResponseDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty()
  name!: string;

  @Expose()
  @ApiProperty()
  slug!: string;

  @Expose()
  @ApiProperty()
  createdAt!: Date;
}
