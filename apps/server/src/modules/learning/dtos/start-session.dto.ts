import { ApiProperty } from '@nestjs/swagger';
import { StudySessionMode } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class StartSessionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studySetId!: string;

  @ApiProperty({ enum: StudySessionMode })
  @IsEnum(StudySessionMode)
  mode!: StudySessionMode;
}
