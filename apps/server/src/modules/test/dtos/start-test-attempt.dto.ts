import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StartTestAttemptDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The study set to generate a test from.',
  })
  @IsUUID()
  studySetId!: string;
}
