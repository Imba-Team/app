import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ForgotPasswordRequestDto {
  @ApiProperty({ description: 'Email address' })
  @IsString()
  @IsNotEmpty()
  email!: string;
}
