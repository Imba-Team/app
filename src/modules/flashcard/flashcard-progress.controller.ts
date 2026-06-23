import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles, Role } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUser } from 'src/common/interfaces/user.interface';
import { FlashcardProgressService } from './flashcard-progress.service';
import { UpdateFlashcardProgressDto } from './dtos/update-flashcard-progress.dto';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { FlashcardWithProgressDto } from './dtos/flashcard-with-progress.dto';
import { plainToInstance } from 'class-transformer';

@ApiTags('Flashcards')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('flashcards')
export class FlashcardProgressController {
  constructor(
    private readonly flashcardProgressService: FlashcardProgressService,
  ) {}

  @Patch(':id/progress')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update my progress for a flashcard' })
  @ApiBody({ type: UpdateFlashcardProgressDto })
  async updateProgress(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
    @Body() dto: UpdateFlashcardProgressDto,
  ): Promise<ResponseDto<FlashcardWithProgressDto>> {
    const flashcard = await this.flashcardProgressService.updateProgress(
      user.id,
      id,
      dto,
    );
    const data = plainToInstance(FlashcardWithProgressDto, flashcard, {
      excludeExtraneousValues: true,
    });
    return { ok: true, message: 'Progress updated', data };
  }

  @Post(':id/update-status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update the status of a flashcard by ID' })
  @ApiBody({ schema: { properties: { success: { type: 'boolean' } } } })
  async updateStatus(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
    @Body('success') success: boolean,
  ): Promise<ResponseDto<FlashcardWithProgressDto>> {
    const flashcard = await this.flashcardProgressService.updateStatus(
      user.id,
      id,
      success,
    );
    const data = plainToInstance(FlashcardWithProgressDto, flashcard, {
      excludeExtraneousValues: true,
    });
    return { ok: true, message: 'Flashcard status updated successfully', data };
  }

  @Get(':id/progress')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get my progress for a flashcard' })
  async getProgress(
    @CurrentUser() user: IUser,
    @Param('id') id: string,
  ): Promise<ResponseDto<FlashcardWithProgressDto>> {
    const flashcard = await this.flashcardProgressService.getProgress(
      user.id,
      id,
    );
    const data = plainToInstance(FlashcardWithProgressDto, flashcard, {
      excludeExtraneousValues: true,
    });
    return { ok: true, message: 'Progress retrieved', data };
  }
}
