import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class PauseSessionDto {
  @ApiPropertyOptional({
    type: Object,
    description:
      'Opaque JSON blob (LearnResumeState on the client) — current batch, batchIndex, hasMoreCards flag, and anything else the client wants to restore. The server only round-trips it. Omit to pause without saving state (rare).',
  })
  @IsOptional()
  @IsObject()
  resumeState?: Record<string, unknown>;
}
