import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class CommentAuthorDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  username: string;

  @ApiProperty()
  @Expose()
  profilePicture: string;
}

export class CommentResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  content: string;

  @ApiProperty()
  @Expose()
  isDeleted: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty({ type: CommentAuthorDto, nullable: true })
  @Expose()
  @Type(() => CommentAuthorDto)
  author: CommentAuthorDto | null;

  @ApiProperty()
  @Expose()
  replyCount: number;
}
