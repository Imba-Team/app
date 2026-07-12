import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Profile shape returned by GET /users/:username.
 *
 * Strictly excludes anything that would leak account state or PII:
 * no email, no role, no status, no emailVerified flag, no Google
 * linkage. Anyone on the public internet can read this if their
 * username is known.
 */
export class PublicProfileDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  username: string;

  @Expose()
  @ApiProperty({ nullable: true })
  bio: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  profilePicture: string | null;

  @Expose()
  @ApiProperty()
  createdAt: Date;
}
