import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import type { FlashcardProgressStatus } from 'src/infrastructure/persistence/flashcard-user-state.mapper';

export class UpdateFlashcardProgressDto {
  @ApiPropertyOptional({ enum: ['not_started', 'in_progress', 'completed'] })
  @IsEnum(['not_started', 'in_progress', 'completed'])
  @IsOptional()
  status?: FlashcardProgressStatus;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isStarred?: boolean;
}
