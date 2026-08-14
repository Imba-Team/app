import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StudySessionMode, StudySessionStatus } from '@prisma/client';
import { Expose } from 'class-transformer';

export class InflightSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  sessionId!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  studySetId!: string;

  @ApiProperty({ enum: StudySessionMode })
  @Expose()
  mode!: StudySessionMode;

  @ApiProperty({ enum: StudySessionStatus })
  @Expose()
  status!: StudySessionStatus;

  @ApiProperty()
  @Expose()
  startedAt!: Date;

  @ApiProperty({
    description:
      'Wall-clock timestamp of the last mutation (answer, pause, resume). Powers the "paused N minutes ago" copy on the resume dialog.',
  })
  @Expose()
  lastActivityAt!: Date;

  @ApiProperty({
    description:
      'Number of cards answered so far in this session — cardsStudied on the session row.',
    example: 4,
  })
  @Expose()
  cardsStudied!: number;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description:
      'Opaque JSON blob written by the client on pause. Structure is a client-side contract (LearnResumeState in the web app); the server only round-trips it. Null when the session was never paused.',
  })
  @Expose()
  resumeState!: unknown | null;
}
