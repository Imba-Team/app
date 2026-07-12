import { IsNotEmpty, IsUUID } from 'class-validator';

export class FolderIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  id!: string;
}
