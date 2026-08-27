import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MarkCorrectDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The card whose last-in-session attempt should be reclassified as CORRECT. Only the most recent CardAttempt for this (session, card) pair is affected.',
  })
  @IsUUID()
  cardId!: string;
}
