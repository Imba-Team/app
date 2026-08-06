import { ApiProperty } from '@nestjs/swagger';

export class SessionDto {
  @ApiProperty({
    description: 'Opaque session identifier. Pass to DELETE /auth/sessions/:id.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiProperty({
    description: 'Raw User-Agent header captured on last token issuance.',
    type: String,
    nullable: true,
    example: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
  })
  userAgent!: string | null;

  @ApiProperty({
    description: 'Client IP recorded on last token issuance.',
    type: String,
    nullable: true,
    example: '203.0.113.42',
  })
  ipAddress!: string | null;

  @ApiProperty({
    description: 'When the session was first created (initial login).',
    example: '2026-08-01T10:15:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'When the session was last used (latest refresh).',
    example: '2026-08-05T18:42:11.000Z',
  })
  lastUsedAt!: string;

  @ApiProperty({
    description: 'When the session will expire if not refreshed.',
    example: '2026-08-31T10:15:00.000Z',
  })
  expiresAt!: string;

  @ApiProperty({
    description:
      'True if this session matches the caller — deleting it logs the ' +
      'current device out.',
    example: true,
  })
  isCurrent!: boolean;
}

export class RevokeSessionResponseDto {
  @ApiProperty({
    description:
      'True if the revoked session is the caller\'s own — the frontend ' +
      'should treat this as a logout signal and clear its cached user.',
    example: false,
  })
  wasCurrent!: boolean;
}
