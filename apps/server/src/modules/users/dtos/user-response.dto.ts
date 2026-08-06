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
  @ApiProperty()
  username: string;

  @Expose()
  @ApiProperty({ description: 'Display name (maps from username)' })
  @Transform(({ obj }) => (obj as { username?: string }).username ?? '')
  name: string;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  bio?: string | null;

  @Expose()
  @ApiProperty()
  emailVerified: boolean;

  @Expose()
  @ApiProperty({ type: String, enum: ['active', 'inactive'] })
  @Transform(({ obj }) => {
    const s = (obj as { status?: string | null }).status;
    return s === 'inactive' ? 'inactive' : 'active';
  })
  status: UserStatus;

  @Expose()
  @ApiProperty({ type: String })
  role: Role;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  profilePicture?: string | null;

  @Expose()
  @ApiProperty({
    description:
      'True if the account is linked to a Google identity and can be ' +
      'signed in via "Continue with Google".',
  })
  @Transform(({ obj }) =>
    Boolean((obj as { googleProviderId?: string | null }).googleProviderId),
  )
  googleLinked: boolean;

  @Expose()
  @ApiProperty({
    description:
      'IANA timezone identifier (e.g. "Europe/Berlin"). Drives per-user ' +
      'SRS today-queue and reminder delivery times.',
    example: 'Europe/Berlin',
  })
  timezone: string;

  @Expose()
  @ApiProperty({
    description: 'BCP-47 language code. Currently one of "en", "ru", "az".',
    example: 'en',
  })
  preferredLanguage: string;
}
