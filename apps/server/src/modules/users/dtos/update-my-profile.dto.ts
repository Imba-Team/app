import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const SUPPORTED_LANGUAGES = ['en', 'ru', 'az'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Validate an IANA timezone identifier (e.g. "Europe/Berlin").
 *
 * Node 18+ ships `Intl.supportedValuesOf('timeZone')` which is the
 * authoritative list. Building it into a Set once per process keeps
 * validation O(1) without shipping a static zone list ourselves.
 */
@ValidatorConstraint({ name: 'IsIanaTimeZone', async: false })
class IsIanaTimeZoneConstraint implements ValidatorConstraintInterface {
  private static readonly zones = new Set(
    (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.('timeZone') ?? [],
  );

  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length === 0) return false;
    // If the runtime can't enumerate zones for any reason (very old
    // Node, non-ICU build), fall back to a try/catch probe via Intl.
    if (IsIanaTimeZoneConstraint.zones.size === 0) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }
    return IsIanaTimeZoneConstraint.zones.has(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid IANA timezone identifier (e.g. "Europe/Berlin")`;
  }
}

/**
 * Self-service profile update for PATCH /users/me.
 *
 * Deliberately narrow: only name, bio, timezone, preferredLanguage.
 * `role`, `status`, `email`, and `profilePicture` are intentionally NOT
 * here — they belong to admin actions, the email-change flow, and the
 * avatar upload endpoint respectively. Allowing them on the
 * self-service endpoint produced the privilege-escalation bug surfaced
 * during the Sprint 3 audit.
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

  @ApiPropertyOptional({
    type: String,
    example: 'Europe/Berlin',
    description:
      'IANA timezone identifier. Used by SRS to compute the user\'s ' +
      'local "today" and to fire reminders at their local morning.',
  })
  @IsOptional()
  @IsString()
  @Validate(IsIanaTimeZoneConstraint)
  timezone?: string;

  @ApiPropertyOptional({
    type: String,
    enum: SUPPORTED_LANGUAGES,
    example: 'en',
    description:
      'BCP-47 language code. Currently used to set the <html lang> ' +
      'attribute; future email templates and AI generation will read ' +
      'from this too.',
  })
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES as unknown as string[])
  preferredLanguage?: SupportedLanguage;
}
