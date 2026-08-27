import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Role } from 'src/common/decorators/roles.decorator';
import { UserStatus } from 'src/common/interfaces/user.interface';

export class CreateUserDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  password: string;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'inactive'],
    required: false,
    default: 'active',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus = UserStatus.ACTIVE;

  @ApiProperty({
    example: Role.USER,
    enum: Object.values(Role),
    required: false,
    default: Role.USER,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role = Role.USER;
}
