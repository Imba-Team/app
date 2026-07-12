import { ApiProperty } from '@nestjs/swagger';
import { StudySessionMode } from '@prisma/client';
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

  @ApiProperty()
  @Expose()
  startedAt!: Date;
}
