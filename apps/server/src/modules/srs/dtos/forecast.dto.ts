import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ForecastQueryDto {
  @ApiProperty({ required: false, default: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class ForecastBucketDto {
  @ApiProperty({ format: 'date', example: '2026-07-24' })
  @Expose()
  date!: string;

  @ApiProperty()
  @Expose()
  dueCount!: number;
}

export class ForecastResponseDto {
  @ApiProperty()
  @Expose()
  days!: number;

  @ApiProperty({ type: [ForecastBucketDto] })
  @Expose()
  @Type(() => ForecastBucketDto)
  buckets!: ForecastBucketDto[];
}
