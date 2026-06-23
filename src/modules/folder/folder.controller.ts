import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';

import { CreateFolderDto } from './dto/create-folder.dto';
import { FolderResponseDto } from './dto/folder-response.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { FolderService } from './folder.service';

@ApiTags('Folders')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('folders')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List all folders of the current user' })
  async findAll(
    @CurrentUser() user: IUser,
  ): Promise<ResponseDto<FolderResponseDto[]>> {
    const folders = await this.folderService.findAllByUser(user.id);
    const data = plainToInstance(FolderResponseDto, folders, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Folders fetched successfully', data };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new folder' })
  @ApiBody({ type: CreateFolderDto })
  async create(
    @CurrentUser() user: IUser,
    @Body() dto: CreateFolderDto,
  ): Promise<ResponseDto<FolderResponseDto>> {
    const folder = await this.folderService.create(user.id, dto);
    const data = plainToInstance(FolderResponseDto, folder, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Folder created successfully', data };
  }

  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get folder by id with its study sets' })
  async findOne(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
  ): Promise<ResponseDto<FolderResponseDto>> {
    const folder = await this.folderService.findOneById(user.id, id);
    const data = plainToInstance(FolderResponseDto, folder, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Folder fetched successfully', data };
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update folder name or description' })
  @ApiBody({ type: UpdateFolderDto })
  async update(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ): Promise<ResponseDto<FolderResponseDto>> {
    const folder = await this.folderService.update(user.id, id, dto);
    const data = plainToInstance(FolderResponseDto, folder, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Folder updated successfully', data };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a folder without deleting study sets' })
  async delete(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
  ): Promise<ResponseDto<null>> {
    await this.folderService.delete(user.id, id);

    return { ok: true, message: 'Folder deleted successfully', data: null };
  }
}
