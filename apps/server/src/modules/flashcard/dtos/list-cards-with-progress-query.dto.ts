import { ApiPropertyOptional } from '@nestjs/swagger';
import { CardMasteryStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Query filters for `GET /study-sets/:setId/cards/progress`.
 *
 * The endpoint returns FlashcardWithProgressDto[]. Filters let clients
 * narrow the set without pulling the full deck and iterating in JS —
 * important once a module has hundreds of cards.
 */
export class ListCardsWithProgressQueryDto {
  @ApiPropertyOptional({
    description: 'Only return cards the caller has starred.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return undefined;
  })
  @IsBoolean()
  starred?: boolean;

  @ApiPropertyOptional({
    enum: CardMasteryStatus,
    description: 'Only return cards in this mastery bucket.',
  })
  @IsOptional()
  @IsEnum(CardMasteryStatus)
  status?: CardMasteryStatus;

  @ApiPropertyOptional({
    description:
      'Case-insensitive substring match on term or definition. Empty / whitespace-only strings are ignored.',
    example: 'photo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
