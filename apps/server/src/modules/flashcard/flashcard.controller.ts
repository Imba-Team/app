import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ApiOkEnvelope } from 'src/common/decorators/api-envelope.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { IUser } from 'src/common/interfaces/user.interface';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { FlashcardResponseDto } from './dtos/flashcard-response.dto';
import {
  FlashcardSearchResponseDto,
  SearchFlashcardsQueryDto,
} from './dtos/search-flashcards.dto';
import { UpdateFlashcardDto } from './dtos/update-flashcard.dto';
import { FlashcardService } from './flashcard.service';

@ApiTags('Flashcards')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('flashcards')
export class FlashcardController {
  constructor(private readonly flashcardService: FlashcardService) {}

  @Get('search')
  @ApiOperation({
    summary: "Search cards across the caller's owned + collaborated sets",
    description:
      'Case-insensitive substring match on term or definition. Scoped ' +
      "to the caller's accessible sets — pass `setId` to narrow to " +
      'a single set. Backed by Postgres (not Elasticsearch): the ' +
      'per-user corpus is small enough that ILIKE outperforms an ES ' +
      'round-trip and it avoids running a private index.',
  })
  @ApiOkEnvelope(FlashcardSearchResponseDto, { description: 'Search hits' })
  async search(
    @CurrentUser() user: IUser,
    @Query() query: SearchFlashcardsQueryDto,
  ): Promise<ResponseDto<FlashcardSearchResponseDto>> {
    const data = await this.flashcardService.search(user.id, query);
    return { ok: true, message: 'Flashcard search results', data };
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update a flashcard' })
  @ApiBody({ type: UpdateFlashcardDto })
  @ApiOkEnvelope(FlashcardResponseDto, { description: 'Flashcard updated' })
  async update(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
    @Body() dto: UpdateFlashcardDto,
  ): Promise<ResponseDto<FlashcardResponseDto>> {
    const data = await this.flashcardService.update(user.id, id, dto);
    return { ok: true, message: 'Flashcard updated', data };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a flashcard' })
  @ApiOkEnvelope(null, { description: 'Flashcard deleted' })
  async delete(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
  ): Promise<ResponseDto<null>> {
    await this.flashcardService.delete(user.id, id);
    return { ok: true, message: 'Flashcard deleted', data: null };
  }
}
