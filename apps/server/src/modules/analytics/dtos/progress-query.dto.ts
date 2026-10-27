import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export const progressRangeOptions = [30, 90] as const;
export type ProgressRange = (typeof progressRangeOptions)[number];

export class ProgressQueryDto {
  @ApiProperty({ required: false, enum: progressRangeOptions, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsIn(progressRangeOptions)
  days?: ProgressRange;
}
