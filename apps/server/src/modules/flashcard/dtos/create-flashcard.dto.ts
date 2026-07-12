import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateFlashcardDto {
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

  @ApiPropertyOptional({
    example: 'Photosynthesis powers most life on Earth.',
  })
  @IsString()
  @IsOptional()
  example?: string;

  @ApiPropertyOptional({ example: '/ˌfoʊtəˈsɪnθəsɪs/' })
  @IsString()
  @IsOptional()
  phonetic?: string;

  @ApiPropertyOptional({ example: 'Starts with "photo-"' })
  @IsString()
  @IsOptional()
  hint?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.mimir.app/cards/abc.jpg',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Position within the set. Auto-assigned if omitted.',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;
}
