import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyEmailRequestDto {
  @ApiProperty({
    description:
      'Verification token from the email link. The frontend extracts ' +
      'this from the URL query string and posts it here.',
    example: 'email-verification-1719158400000-abc123...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token!: string;
}
