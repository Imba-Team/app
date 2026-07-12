import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetNextBatchQueryDto {
  @ApiPropertyOptional({
    default: 10,
    minimum: 1,
    maximum: 20,
    description: 'Target number of cards to include in the batch.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  size?: number = 10;
}
