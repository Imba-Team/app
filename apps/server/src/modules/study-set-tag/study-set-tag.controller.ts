import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StudySetVisibility } from '@prisma/client';
import { plainToInstance } from 'class-transformer';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { CreateStudySetTagDto } from './dto/create-study-set-tag.dto';
import { StudySetListItemDto } from './dto/study-set-list-item.dto';
import { StudySetTagParamsDto } from './dto/study-set-tag-params.dto';
import { StudySetTagResponseDto } from './dto/study-set-tag-response.dto';
import { TagListItemDto } from './dto/tag-list-item.dto';
import { StudySetTagService } from './study-set-tag.service';

@ApiTags('Study Set Tags')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('study-set-tags')
export class StudySetTagController {
  constructor(private readonly studySetTagService: StudySetTagService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a tag to a study set' })
  @ApiBody({ type: CreateStudySetTagDto })
  async addTagToStudySet(
    @CurrentUser() user: IUser,
    @Body() dto: CreateStudySetTagDto,
  ): Promise<ResponseDto<StudySetTagResponseDto>> {
    const studySetTag = await this.studySetTagService.addTagToStudySet(
      user,
      dto,
    );
    const data = plainToInstance(StudySetTagResponseDto, studySetTag, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Tag added to study set', data };
  }

  @Delete(':studySetId/:tagId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a tag from a study set' })
  async removeTagFromStudySet(
    @CurrentUser() user: IUser,
    @Param() params: StudySetTagParamsDto,
  ): Promise<ResponseDto<null>> {
    await this.studySetTagService.removeTagFromStudySet(
      user,
      params.studySetId,
      params.tagId,
    );

    return { ok: true, message: 'Tag removed from study set', data: null };
  }

  @Get('study-sets/:studySetId/tags')
  @HttpCode(200)
  @ApiOperation({ summary: 'List tags for a given study set' })
  async listTagsForStudySet(
    @CurrentUser() user: IUser,
    @Param('studySetId') studySetId: string,
  ): Promise<ResponseDto<TagListItemDto[]>> {
    const tags = await this.studySetTagService.listTagsForStudySet(
      user,
      studySetId,
    );
    const data = plainToInstance(TagListItemDto, tags, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Study set tags fetched', data };
  }

  @Get('tags/:tagId/study-sets')
  @HttpCode(200)
  @ApiOperation({ summary: 'List study sets for a given tag' })
  async listStudySetsForTag(
    @CurrentUser() user: IUser,
    @Param('tagId') tagId: string,
  ): Promise<ResponseDto<StudySetListItemDto[]>> {
    const studySets = await this.studySetTagService.listStudySetsForTag(
      user,
      tagId,
    );
    const data = plainToInstance(
      StudySetListItemDto,
      studySets.map((studySet) => ({
        ...studySet,
        isPrivate: studySet.visibility === StudySetVisibility.PRIVATE,
      })),
      {
        excludeExtraneousValues: true,
      },
    );

    return { ok: true, message: 'Tagged study sets fetched', data };
  }
}
