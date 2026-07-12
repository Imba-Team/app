import { IsNotEmpty, IsUUID } from 'class-validator';

export class StudySetTagParamsDto {
  @IsUUID()
  @IsNotEmpty()
  studySetId!: string;

  @IsUUID()
  @IsNotEmpty()
  tagId!: string;
}
