import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateFlashcardDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    description: 'Study set ID this flashcard belongs to',
  })
  @IsUUID()
  @IsNotEmpty()
  studySetId!: string;

  @ApiProperty({ example: 'Photosynthesis' })
  @IsString()
  @IsNotEmpty()
  term!: string;

  @ApiProperty({
    example: 'The process by which green plants convert sunlight into energy.',
  })
  @IsString()
  @IsNotEmpty()
  definition!: string;
}
