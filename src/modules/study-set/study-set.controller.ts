import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { StudySetService } from './study-set.service';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles, Role } from 'src/common/decorators/roles.decorator';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { CreateStudySetDto } from './dtos/create-study-set.dto';
import { UpdateStudySetDto } from './dtos/update-study-set.dto';
import { UpdateVisibilityDto } from './dtos/update-visibility.dto';
import { SearchStudySetsDto } from './dtos/search-study-sets.dto';
import { StudySetResponseDto } from './dtos/study-set-response.dto';

@ApiTags('Study Sets')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('study-sets')
export class StudySetController {
  constructor(private readonly studySetService: StudySetService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a study set' })
  @ApiBody({ type: CreateStudySetDto })
  async create(
    @CurrentUser() user: IUser,
    @Body() dto: CreateStudySetDto,
  ): Promise<ResponseDto<StudySetResponseDto>> {
    const studySet = await this.studySetService.create(user.id, dto);
    const data = plainToInstance(StudySetResponseDto, studySet, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Study set created', data };
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update own study set' })
  @ApiBody({ type: UpdateStudySetDto })
  async update(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
    @Body() dto: UpdateStudySetDto,
  ): Promise<ResponseDto<StudySetResponseDto>> {
    const studySet = await this.studySetService.update(user.id, id, dto);
    const data = plainToInstance(StudySetResponseDto, studySet, {
      excludeExtraneousValues: true,
    });
    return { ok: true, message: 'Study set updated', data };
  }

  @Patch(':id/visibility')
  @HttpCode(200)
  @ApiOperation({ summary: 'Make study set public/private' })
  async updateVisibility(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
    @Body() dto: UpdateVisibilityDto,
  ): Promise<ResponseDto<StudySetResponseDto>> {
    const studySet = await this.studySetService.updateVisibility(
      user.id,
      id,
      dto,
    );
    const data = plainToInstance(StudySetResponseDto, studySet, {
      excludeExtraneousValues: true,
    });
    return { ok: true, message: 'Visibility updated', data };
  }

  @Get('me')
  @HttpCode(200)
  @ApiOperation({
    summary: 'List study sets I created',
  })
  async myStudySets(
    @CurrentUser() user: IUser,
  ): Promise<ResponseDto<StudySetResponseDto[]>> {
    const studySets = await this.studySetService.findCreatedStudySets(user.id);
    const data = studySets.map((s) =>
      plainToInstance(StudySetResponseDto, s, {
        excludeExtraneousValues: true,
      }),
    );
    return { ok: true, message: 'Study sets retrieved', data };
  }

  @Get('collection')
  @HttpCode(200)
  @ApiOperation({ summary: 'List study sets in my collection' })
  async myCollection(
    @CurrentUser() user: IUser,
  ): Promise<ResponseDto<StudySetResponseDto[]>> {
    const studySets = await this.studySetService.findCollection(user.id);
    const data = studySets.map((s) =>
      plainToInstance(StudySetResponseDto, s, {
        excludeExtraneousValues: true,
      }),
    );
    return { ok: true, message: 'Collection retrieved', data };
  }

  @Get('public')
  @HttpCode(200)
  @ApiQuery({ name: 'q', required: false })
  @ApiOperation({ summary: 'Search public study sets' })
  async publicStudySets(
    @CurrentUser() user: IUser,
    @Query() query: SearchStudySetsDto,
  ): Promise<ResponseDto<StudySetResponseDto[]>> {
    const studySets = await this.studySetService.searchPublic(user.id, query);
    const data = studySets.map((s) =>
      plainToInstance(StudySetResponseDto, s, {
        excludeExtraneousValues: true,
      }),
    );
    return { ok: true, message: 'Public study sets retrieved', data };
  }

  @Post(':id/collect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Add a public study set to my collection' })
  async collect(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
  ): Promise<ResponseDto<StudySetResponseDto>> {
    const studySet = await this.studySetService.addToCollection(user.id, id);
    const data = plainToInstance(StudySetResponseDto, studySet, {
      excludeExtraneousValues: true,
    });
    return { ok: true, message: 'Study set added to collection', data };
  }

  @Post(':id/uncollect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a study set from my collection' })
  async uncollect(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
  ): Promise<ResponseDto<StudySetResponseDto>> {
    const studySet = await this.studySetService.removeFromCollection(
      user.id,
      id,
    );
    const data = plainToInstance(StudySetResponseDto, studySet, {
      excludeExtraneousValues: true,
    });
    return { ok: true, message: 'Study set removed from collection', data };
  }

  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get study set details' })
  async getOne(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
  ): Promise<ResponseDto<StudySetResponseDto>> {
    const studySet = await this.studySetService.getById(user.id, id);
    const data = plainToInstance(StudySetResponseDto, studySet, {
      excludeExtraneousValues: true,
    });
    return { ok: true, message: 'Study set retrieved', data };
  }
}
