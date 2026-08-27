import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleStarDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isStarred!: boolean;
}
