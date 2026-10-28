import {
  Body,
  Controller,
  Delete,
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

import { ApiOkEnvelope } from 'src/common/decorators/api-envelope.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles, Role } from 'src/common/decorators/roles.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { CreateTagDto } from './dto/create-tag.dto';
import { SuggestTagsQueryDto } from './dto/suggest-tags-query.dto';
import { TagListItemDto } from './dto/tag-list-item.dto';
import { TagResponseDto } from './dto/tag-response.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagService } from './tag.service';

@ApiTags('Tags')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a tag' })
  @ApiBody({ type: CreateTagDto })
  async create(
    @Body() dto: CreateTagDto,
  ): Promise<ResponseDto<TagResponseDto>> {
    const tag = await this.tagService.create(dto);
    const data = plainToInstance(TagResponseDto, tag, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Tag created successfully', data };
  }

  @Get()
  @Roles(Role.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all tags with pagination' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ): Promise<
    ResponseDto<TagResponseDto[]> & {
      meta: { total: number; page: number; limit: number; totalPages: number };
    }
  > {
    const result = await this.tagService.findAll(+page, +limit, search);
    const data = plainToInstance(TagResponseDto, result.data, {
      excludeExtraneousValues: true,
    });

    return {
      ok: true,
      message: 'Tags fetched successfully',
      data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  // Declared before `:id` so "suggest" isn't captured as an id.
  @Get('suggest')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Suggest tags for the tag input',
    description:
      'Tags used on public sets or on your own sets, most-used first. Open to every signed-in user.',
  })
  @ApiOkEnvelope(TagListItemDto, { isArray: true })
  async suggest(
    @CurrentUser() user: IUser,
    @Query() query: SuggestTagsQueryDto,
  ): Promise<ResponseDto<TagListItemDto[]>> {
    // ValidationPipe runs without `transform`, so coerce here.
    const limit = query.limit !== undefined ? Number(query.limit) : 8;
    const tags = await this.tagService.suggest(user.id, query.q, limit);
    const data = plainToInstance(TagListItemDto, tags, {
      excludeExtraneousValues: true,
    });
    return { ok: true, message: 'Tag suggestions fetched', data };
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Get a tag by ID' })
  async findOne(@Param('id') id: string): Promise<ResponseDto<TagResponseDto>> {
    const tag = await this.tagService.findOne(id);
    const data = plainToInstance(TagResponseDto, tag, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Tag fetched successfully', data };
  }

  @Patch(':id')
  @HttpCode(200)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a tag by ID' })
  @ApiBody({ type: UpdateTagDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ): Promise<ResponseDto<TagResponseDto>> {
    const tag = await this.tagService.update(id, dto);
    const data = plainToInstance(TagResponseDto, tag, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Tag updated successfully', data };
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a tag by ID' })
  async delete(@Param('id') id: string): Promise<ResponseDto<null>> {
    await this.tagService.delete(id);

    return { ok: true, message: 'Tag deleted successfully', data: null };
  }
}
