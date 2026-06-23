import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { Role } from 'src/common/decorators/roles.decorator';
import { UserStatus } from 'src/common/interfaces/user.interface';

export class UserResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  email: string;

  @Expose()
  @ApiProperty({ description: 'Display name (maps from username)' })
  @Transform(({ obj }) => (obj as { username?: string }).username ?? '')
  name: string;

  @Expose()
  @ApiProperty()
  @Transform(({ obj }) => {
    const s = (obj as { status?: string | null }).status;
    return s === 'inactive' ? 'inactive' : 'active';
  })
  status: UserStatus;

  @Expose()
  @ApiProperty()
  role: Role;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;

  @Expose()
  @ApiProperty({ nullable: true })
  profilePicture?: string | null;
}
