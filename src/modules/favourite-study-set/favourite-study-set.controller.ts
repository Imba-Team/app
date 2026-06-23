import {
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUser } from 'src/common/interfaces/user.interface';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { JwtGuard } from 'src/guards/jwt.guard';
import { FavouriteStudySet } from '@prisma/client';

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
  async addToLibrary(
    @CurrentUser() user: IUser,
    @Param() params: CreateFavouriteStudySetDto,
  ): Promise<ResponseDto<FavouriteStudySet>> {
    const data = await this.favouriteStudySetService.addToLibrary(
      user.id,
      params.studySetId,
    );
    return { ok: true, message: 'Study set saved to library', data };
  }

  @Delete(':studySetId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a study set from my library' })
  async removeFromLibrary(
    @CurrentUser() user: IUser,
    @Param() params: CreateFavouriteStudySetDto,
  ): Promise<void> {
    await this.favouriteStudySetService.removeFromLibrary(
      user.id,
      params.studySetId,
    );
  }
}
