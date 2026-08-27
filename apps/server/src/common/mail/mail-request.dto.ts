import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

export class MailRequestDto {
  @ApiProperty({ description: 'Recipient email address' })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiProperty({ description: 'ID of the user to whom the email is related' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Purpose of the email (e.g., password_reset, welcome)',
  })
  @IsString()
  @IsNotEmpty()
  purpose: string;
}
