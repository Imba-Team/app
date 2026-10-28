// src/modules/auth/dtos/register.dto.ts
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  noAngleBracketsPattern,
  textLimits,
} from 'src/common/text/text-limits';

export class RegisterRequestDto {
  @ApiProperty({ example: 'John', maxLength: textLimits.displayName })
  @IsString()
  @MaxLength(textLimits.displayName)
  @Matches(noAngleBracketsPattern, {
    message: 'username must not contain < or >',
  })
  username!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password!: string;
}
