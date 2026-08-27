import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const PACE_PRESETS = ['chill', 'default', 'aggressive'] as const;
export type PacePreset = (typeof PACE_PRESETS)[number];

export class ApplyPresetDto {
  @ApiProperty({
    enum: PACE_PRESETS,
    description:
      'Study pace preset. Populates batchSize, mcWrittenBias, masteryThreshold, and autoAdvanceMs with the preset values, leaving other fields untouched.',
  })
  @IsIn(PACE_PRESETS)
  preset!: PacePreset;
}
