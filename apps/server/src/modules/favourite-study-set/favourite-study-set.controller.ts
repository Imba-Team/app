import {
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
} from 'src/common/decorators/api-envelope.decorator';
import { IUser } from 'src/common/interfaces/user.interface';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { JwtGuard } from 'src/guards/jwt.guard';
import { StudySetResponseDto } from 'src/modules/study-set/dtos/study-set-response.dto';

import { CreateFavouriteStudySetDto } from './dto/create-favourite-study-set.dto';
import { FavouriteStudySetService } from './favourite-study-set.service';

@ApiTags('Library')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('me/library')
export class FavouriteStudySetController {
  constructor(
    private readonly favouriteStudySetService: FavouriteStudySetService,
  ) {}

  @Post(':studySetId')
  @HttpCode(201)
  @ApiOperation({ summary: 'Save a study set to my library' })
  @ApiCreatedEnvelope(StudySetResponseDto, {
    description: 'Study set saved to library',
  })
  async addToLibrary(
    @CurrentUser() user: IUser,
    @Param('studySetId') studySetId: string,
  ): Promise<ResponseDto<StudySetResponseDto>> {
    const studySet = await this.favouriteStudySetService.addToLibrary(
      user.id,
      studySetId,
    );
    const data = plainToInstance(StudySetResponseDto, studySet, {
      excludeExtraneousValues: true,
    });
    return { ok: true, message: 'Study set saved to library', data };
  }

  @Delete(':studySetId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a study set from my library' })
  @ApiOkEnvelope(null, { description: 'Study set removed from library' })
  async removeFromLibrary(
    @CurrentUser() user: IUser,
    @Param('studySetId') studySetId: string,
  ): Promise<ResponseDto<null>> {
    await this.favouriteStudySetService.removeFromLibrary(user.id, studySetId);
    return { ok: true, message: 'Study set removed from library', data: null };
  }
}
