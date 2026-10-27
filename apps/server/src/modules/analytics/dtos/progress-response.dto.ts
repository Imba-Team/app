import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ProgressTotalsDto {
  @ApiProperty({ description: 'Cards answered in the range (all modes).' })
  @Expose()
  cardsAnswered!: number;

  @ApiProperty()
  @Expose()
  correct!: number;

  @ApiProperty({ description: 'Minutes in completed sessions and tests.' })
  @Expose()
  minutes!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'correct / cardsAnswered (0–1); null with no answers.',
  })
  @Expose()
  accuracy!: number | null;
}

export class ProgressDayDto {
  @ApiProperty({ format: 'date', example: '2026-10-27' })
  @Expose()
  date!: string;

  @ApiProperty()
  @Expose()
  cardsAnswered!: number;

  @ApiProperty()
  @Expose()
  correct!: number;

  @ApiProperty()
  @Expose()
  minutes!: number;
}

export class MasteryPointDto {
  @ApiProperty({ format: 'date', example: '2026-10-27' })
  @Expose()
  date!: string;

  @ApiProperty()
  @Expose()
  newCount!: number;

  @ApiProperty()
  @Expose()
  learningCount!: number;

  @ApiProperty()
  @Expose()
  masteredCount!: number;
}

export class RetentionBucketDto {
  @ApiProperty({
    enum: ['1d', '3d', '1w', '1m', '1m+'],
    description:
      'How long the card had been away: ≤1 day, 2–3 days, 4–7 days, 8–29 days, 30+ days.',
  })
  @Expose()
  bucket!: '1d' | '3d' | '1w' | '1m' | '1m+';

  @ApiProperty()
  @Expose()
  total!: number;

  @ApiProperty({ description: 'Reviews rated anything but AGAIN.' })
  @Expose()
  remembered!: number;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  rate!: number | null;
}

export class ProgressResponseDto {
  @ApiProperty({ enum: [30, 90] })
  @Expose()
  days!: number;

  @ApiProperty({ example: 'Europe/Berlin' })
  @Expose()
  timezone!: string;

  @ApiProperty({ description: 'Consecutive study days up to today.' })
  @Expose()
  currentStreak!: number;

  @ApiProperty()
  @Expose()
  bestStreak!: number;

  @ApiProperty()
  @Expose()
  studiedToday!: boolean;

  @ApiProperty({ type: ProgressTotalsDto })
  @Expose()
  @Type(() => ProgressTotalsDto)
  totals!: ProgressTotalsDto;

  @ApiProperty({
    type: [ProgressDayDto],
    description: 'One entry per local day in the range, oldest first.',
  })
  @Expose()
  @Type(() => ProgressDayDto)
  activity!: ProgressDayDto[];

  @ApiProperty({
    type: [MasteryPointDto],
    description:
      'Nightly snapshots plus a live point for today, summed across sets.',
  })
  @Expose()
  @Type(() => MasteryPointDto)
  mastery!: MasteryPointDto[];

  @ApiProperty({ type: [RetentionBucketDto] })
  @Expose()
  @Type(() => RetentionBucketDto)
  retention!: RetentionBucketDto[];
}
