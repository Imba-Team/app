import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { IUser } from 'src/common/interfaces/user.interface';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { FlashcardResponseDto } from './dtos/flashcard-response.dto';
import { UpdateFlashcardDto } from './dtos/update-flashcard.dto';
import { FlashcardService } from './flashcard.service';

@ApiTags('Flashcards')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('flashcards')
export class FlashcardController {
  constructor(private readonly flashcardService: FlashcardService) {}

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update a flashcard' })
  @ApiBody({ type: UpdateFlashcardDto })
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
  async delete(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
  ): Promise<ResponseDto<null>> {
    await this.flashcardService.delete(user.id, id);
    return { ok: true, message: 'Flashcard deleted', data: null };
  }
}
