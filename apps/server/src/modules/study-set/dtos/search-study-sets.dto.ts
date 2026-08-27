import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum PublicSetSort {
  RECENT = 'recent',
  POPULAR = 'popular',
}

export class SearchStudySetsDto {
  @ApiPropertyOptional({
    example: 'biology',
    description: 'Searches title or description',
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    enum: PublicSetSort,
    default: PublicSetSort.RECENT,
    description:
      "Only honoured by /study-sets/public. 'popular' sorts by viewCount desc.",
  })
  @IsEnum(PublicSetSort)
  @IsOptional()
  sort?: PublicSetSort;
}
