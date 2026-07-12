import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateFavouriteStudySetDto {
  @IsUUID()
  @IsNotEmpty()
  studySetId!: string;
}
