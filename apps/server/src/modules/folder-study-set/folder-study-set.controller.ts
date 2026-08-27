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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';

import { AddFolderStudySetsDto } from './dto/add-folder-study-sets.dto';
import { AddFolderStudySetsResponseDto } from './dto/add-folder-study-sets-response.dto';
import { FolderIdParamDto } from './dto/folder-id-param.dto';
import { FolderStudySetListItemDto } from './dto/folder-study-set-list-item.dto';
import { RemoveFolderStudySetParamDto } from './dto/remove-folder-study-set-param.dto';
import { FolderStudySetService } from './folder-study-set.service';

@ApiTags('Folder Study Sets')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('folders')
export class FolderStudySetController {
  constructor(private readonly folderStudySetService: FolderStudySetService) {}

  @Post(':id/study-sets')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add study set(s) to folder' })
  @ApiBody({ type: AddFolderStudySetsDto })
  @ApiParam({ name: 'id', description: 'Folder id', format: 'uuid' })
  async addStudySetsToFolder(
    @CurrentUser() user: IUser,
    @Param() params: FolderIdParamDto,
    @Body() dto: AddFolderStudySetsDto,
  ): Promise<ResponseDto<AddFolderStudySetsResponseDto>> {
    const result = await this.folderStudySetService.addStudySetsToFolder(
      user,
      params.id,
      dto,
    );
    const data = plainToInstance(AddFolderStudySetsResponseDto, result, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Study sets added to folder', data };
  }

  @Delete(':id/study-sets/:studySetId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a study set from folder' })
  @ApiParam({ name: 'id', description: 'Folder id', format: 'uuid' })
  @ApiParam({
    name: 'studySetId',
    description: 'Study set id',
    format: 'uuid',
  })
  async removeStudySetFromFolder(
    @CurrentUser() user: IUser,
    @Param() params: RemoveFolderStudySetParamDto,
  ): Promise<ResponseDto<null>> {
    await this.folderStudySetService.removeStudySetFromFolder(
      user,
      params.id,
      params.studySetId,
    );

    return { ok: true, message: 'Study set removed from folder', data: null };
  }

  @Get(':id/study-sets')
  @HttpCode(200)
  @ApiOperation({ summary: 'List all study sets in a folder' })
  @ApiParam({ name: 'id', description: 'Folder id', format: 'uuid' })
  async listStudySetsInFolder(
    @CurrentUser() user: IUser,
    @Param() params: FolderIdParamDto,
  ): Promise<ResponseDto<FolderStudySetListItemDto[]>> {
    const studySets = await this.folderStudySetService.listStudySetsInFolder(
      user,
      params.id,
    );
    const data = plainToInstance(FolderStudySetListItemDto, studySets, {
      excludeExtraneousValues: true,
    });

    return {
      ok: true,
      message: 'Folder study sets fetched successfully',
      data,
    };
  }
}
