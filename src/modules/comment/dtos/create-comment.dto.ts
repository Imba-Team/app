import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    example: 'Great set, helped me with revision.',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @Length(1, 2000)
  content: string;

  @ApiPropertyOptional({
    description: 'Parent comment id when creating a reply',
    example: 'd1939ef4-f714-42ce-acf5-9dbe8260f2f2',
  })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
