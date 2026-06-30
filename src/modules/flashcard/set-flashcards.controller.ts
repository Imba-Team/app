import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { IUser } from 'src/common/interfaces/user.interface';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { CreateFlashcardDto } from './dtos/create-flashcard.dto';
import { FlashcardResponseDto } from './dtos/flashcard-response.dto';
import { FlashcardService } from './flashcard.service';

@ApiTags('Flashcards')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('study-sets')
export class SetFlashcardsController {
  constructor(private readonly flashcardService: FlashcardService) {}

  @Post(':setId/cards')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a flashcard in a study set' })
  @ApiBody({ type: CreateFlashcardDto })
  async create(
    @CurrentUser() user: IUser,
    @Param('setId') setId: string,
    @Body() dto: CreateFlashcardDto,
  ): Promise<ResponseDto<FlashcardResponseDto>> {
    const data = await this.flashcardService.create(user.id, setId, dto);
    return { ok: true, message: 'Flashcard created', data };
  }

  @Get(':setId/cards')
  @HttpCode(200)
  @ApiOperation({ summary: 'List flashcards in a study set' })
  async list(
    @CurrentUser() user: IUser,
    @Param('setId') setId: string,
  ): Promise<ResponseDto<FlashcardResponseDto[]>> {
    const data = await this.flashcardService.list(user.id, setId);
    return { ok: true, message: 'Flashcards retrieved', data };
  }
}
