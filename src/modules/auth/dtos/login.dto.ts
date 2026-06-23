import {
  IsEmail,
  //   IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'password123' })
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  password!: string;
}
