import { IsNotEmpty, IsUUID } from 'class-validator';

export class RemoveFolderStudySetParamDto {
  @IsUUID()
  @IsNotEmpty()
  id!: string;

  @IsUUID()
  @IsNotEmpty()
  studySetId!: string;
}
