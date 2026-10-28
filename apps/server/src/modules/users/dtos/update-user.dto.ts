import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  Matches,
} from 'class-validator';
import {
  assetRefPattern,
  noAngleBracketsPattern,
  textLimits,
} from 'src/common/text/text-limits';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from 'src/common/interfaces/user.interface';
import { Role } from 'src/common/decorators/roles.decorator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(noAngleBracketsPattern, { message: 'name must not contain < or >' })
  name?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    example: 'https://cdn.mimir.app/profile-pictures/abc.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(textLimits.assetRef)
  @Matches(assetRefPattern, {
    message: 'profilePicture must be an http(s) URL or a storage object name',
  })
  profilePicture?: string;
}
