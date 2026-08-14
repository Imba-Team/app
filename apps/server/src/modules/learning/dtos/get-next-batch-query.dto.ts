import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

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

  @ApiPropertyOptional({
    default: false,
    description:
      'When true, prioritize cards that are due today per SRS. Falls back to the standard learning/new mix when no due cards remain. Powers the "review due" entry from the module page.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value === 'true' : Boolean(value),
  )
  @IsBoolean()
  dueFirst?: boolean = false;
}
