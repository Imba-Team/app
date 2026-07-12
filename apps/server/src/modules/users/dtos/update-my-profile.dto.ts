import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Self-service profile update for PATCH /users/me.
 *
 * Deliberately narrow: only name and bio. `role`, `status`, `email`, and
 * `profilePicture` are intentionally NOT here — they belong to admin
 * actions, the email-change flow, and the avatar upload endpoint
 * respectively. Allowing them on the self-service endpoint produced
 * the privilege-escalation bug surfaced during the Sprint 3 audit.
 */
export class UpdateMyProfileDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    example: 'Vocabulary nerd. Always learning.',
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;
}
