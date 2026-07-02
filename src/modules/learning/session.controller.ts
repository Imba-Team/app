import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { AnswerResponseDto } from './dtos/answer-response.dto';
import { SessionSummaryDto } from './dtos/session-summary.dto';
import { StartSessionResponseDto } from './dtos/start-session-response.dto';
import { StartSessionDto } from './dtos/start-session.dto';
import { SubmitAnswerDto } from './dtos/submit-answer.dto';
import { LearningService } from './learning.service';

@ApiTags('Learning')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('sessions')
export class SessionController {
  constructor(private readonly learningService: LearningService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Start a new study session' })
  async start(
    @CurrentUser() user: IUser,
    @Body() dto: StartSessionDto,
  ): Promise<ResponseDto<StartSessionResponseDto>> {
    const data = await this.learningService.startSession(user.id, dto);
    return { ok: true, message: 'Session started', data };
  }

  @Post(':id/answer')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Submit an answer within a session',
    description:
      'Applies the outcome to the card mastery engine and returns the updated card + set progress.',
  })
  async answer(
    @CurrentUser() user: IUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: SubmitAnswerDto,
  ): Promise<ResponseDto<AnswerResponseDto>> {
    const data = await this.learningService.submitAnswer(
      user.id,
      sessionId,
      dto,
    );
    return { ok: true, message: 'Answer recorded', data };
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a session complete and return the summary' })
  async complete(
    @CurrentUser() user: IUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
  ): Promise<ResponseDto<SessionSummaryDto>> {
    const data = await this.learningService.completeSession(user.id, sessionId);
    return { ok: true, message: 'Session completed', data };
  }
}
