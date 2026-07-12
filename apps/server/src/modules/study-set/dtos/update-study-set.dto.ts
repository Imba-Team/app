import { PartialType } from '@nestjs/swagger';
import { CreateStudySetDto } from './create-study-set.dto';

export class UpdateStudySetDto extends PartialType(CreateStudySetDto) {}
