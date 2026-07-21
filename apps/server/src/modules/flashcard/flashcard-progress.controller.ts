import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ApiOkEnvelope } from 'src/common/decorators/api-envelope.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { FlashcardWithProgressDto } from './dtos/flashcard-with-progress.dto';
import { ToggleStarDto } from './dtos/toggle-star.dto';
import { FlashcardProgressService } from './flashcard-progress.service';

@ApiTags('Flashcards')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('flashcards')
export class FlashcardProgressController {
  constructor(
    private readonly flashcardProgressService: FlashcardProgressService,
  ) {}

  @Get(':id/progress')
  @HttpCode(200)
  @ApiOperation({ summary: 'Read my mastery progress for a flashcard' })
  @ApiOkEnvelope(FlashcardWithProgressDto, { description: 'Progress retrieved' })
  async getProgress(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
  ): Promise<ResponseDto<FlashcardWithProgressDto>> {
    const data = await this.flashcardProgressService.getProgress(user.id, id);
    return { ok: true, message: 'Progress retrieved', data };
  }

  @Put(':id/star')
  @HttpCode(200)
  @ApiOperation({ summary: 'Toggle the star flag on a flashcard' })
  @ApiOkEnvelope(FlashcardWithProgressDto, { description: 'Star updated' })
  async toggleStar(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
    @Body() dto: ToggleStarDto,
  ): Promise<ResponseDto<FlashcardWithProgressDto>> {
    const data = await this.flashcardProgressService.setStarred(
      user.id,
      id,
      dto.isStarred,
    );
    return { ok: true, message: 'Star updated', data };
  }
}
