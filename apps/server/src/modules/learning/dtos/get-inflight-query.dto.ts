import { ApiProperty } from '@nestjs/swagger';
import { StudySessionMode } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class GetInflightQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  setId!: string;

  @ApiProperty({
    enum: StudySessionMode,
    description: 'Only the mode you plan to enter is looked up.',
  })
  @IsEnum(StudySessionMode)
  mode!: StudySessionMode;
}
