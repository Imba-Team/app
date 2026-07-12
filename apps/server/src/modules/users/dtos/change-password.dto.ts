import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Old password' })
  @IsString()
  oldPassword: string;

  @ApiProperty({ description: 'New password' })
  @IsString()
  @MinLength(6)
  newPassword: string;

  @ApiProperty({ description: 'Confirm new password' })
  @IsString()
  confirmPassword: string;
}
