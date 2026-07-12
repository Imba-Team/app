import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SearchStudySetsDto {
  @ApiPropertyOptional({
    example: 'biology',
    description: 'Searches title or description',
  })
  @IsString()
  @IsOptional()
  q?: string;
}
