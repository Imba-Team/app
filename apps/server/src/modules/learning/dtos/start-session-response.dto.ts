import { ApiProperty } from '@nestjs/swagger';
import { StudySessionMode, StudySessionStatus } from '@prisma/client';
import { Expose } from 'class-transformer';

export class StartSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  sessionId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  studySetId!: string;

  @ApiProperty({ enum: StudySessionMode })
  @Expose()
  mode!: StudySessionMode;

  @ApiProperty({
    enum: StudySessionStatus,
    description:
      'Session lifecycle. On a fresh start this is ACTIVE. On a resumed in-flight session it may be ACTIVE or PAUSED — the client should treat both as continuable.',
  })
  @Expose()
  status!: StudySessionStatus;

  @ApiProperty({
    description:
      'True when the caller already had an in-flight session for this (set, mode) pair and the server returned it instead of creating a new one. The client can use this to render "resumed" UI without a separate lookup.',
    example: false,
  })
  @Expose()
  resumed!: boolean;

  @ApiProperty()
  @Expose()
  startedAt!: Date;
}
