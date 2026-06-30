import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchSetHitDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  description?: string | null;

  @ApiProperty({ nullable: true })
  language?: string | null;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty()
  ownerId!: string;

  @ApiPropertyOptional({ nullable: true })
  ownerUsername?: string | null;

  @ApiProperty()
  cardCount!: number;

  @ApiProperty()
  likeCount!: number;

  @ApiProperty({
    description: 'BM25 relevance score returned by Elasticsearch.',
    nullable: true,
  })
  score?: number | null;

  @ApiPropertyOptional({
    description:
      'Highlighted fragments from matched fields, keyed by field name.',
    example: { title: ['<em>Photo</em>synthesis'] },
  })
  highlights?: Record<string, string[]>;
}

export class SearchSetsResponseDto {
  @ApiProperty({ type: [SearchSetHitDto] })
  items!: SearchSetHitDto[];

  @ApiProperty({ example: 137 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
