import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
} from 'src/common/decorators/api-envelope.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { AnswerResponseDto } from './dtos/answer-response.dto';
import { GetNextBatchQueryDto } from './dtos/get-next-batch-query.dto';
import { LearnBatchResponseDto } from './dtos/learn-batch-response.dto';
import { ListSessionsQueryDto } from './dtos/list-sessions-query.dto';
import { SessionHistoryItemDto } from './dtos/session-history-item.dto';
import { SessionSummaryDto } from './dtos/session-summary.dto';
import { StartSessionResponseDto } from './dtos/start-session-response.dto';
import { StartSessionDto } from './dtos/start-session.dto';
import { SubmitAnswerDto } from './dtos/submit-answer.dto';
import { SubmitWrittenAnswerDto } from './dtos/submit-written-answer.dto';
import { WrittenAnswerResponseDto } from './dtos/written-answer-response.dto';
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
  @ApiCreatedEnvelope(StartSessionResponseDto, {
    description: 'Session started',
  })
  async start(
    @CurrentUser() user: IUser,
    @Body() dto: StartSessionDto,
  ): Promise<ResponseDto<StartSessionResponseDto>> {
    const data = await this.learningService.startSession(user.id, dto);
    return { ok: true, message: 'Session started', data };
  }

  @Get()
  @HttpCode(200)
  @ApiOperation({
    summary: 'List my study session history',
    description:
      "Paginated. Optionally filter by studySetId to power the set page's activity list. Ordered newest-first by startedAt.",
  })
  @ApiOkEnvelope(SessionHistoryItemDto, {
    isArray: true,
    description: 'Sessions retrieved',
  })
  async list(
    @CurrentUser() user: IUser,
    @Query() query: ListSessionsQueryDto,
  ): Promise<ResponseDto<SessionHistoryItemDto[]>> {
    const { items, total, limit, offset } =
      await this.learningService.listSessions(user.id, query);
    return {
      ok: true,
      message: 'Sessions retrieved',
      data: items,
      meta: {
        total,
        limit,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Post(':id/answer')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Submit an answer within a session',
    description:
      'Applies the outcome to the card mastery engine and returns the updated card + set progress.',
  })
  @ApiOkEnvelope(AnswerResponseDto, { description: 'Answer recorded' })
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

  @Post(':id/answer-written')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Submit a typed answer — server evaluates and applies to mastery',
    description:
      "For Write / Learn-written / Test-written / AI-generated modes. The server runs the Levenshtein-tolerant evaluator against the card's canonical definition, translates the result into a mastery-engine outcome, and returns both the applied progress and the evaluation details (matchType, similarity, edit distance, normalized strings) so the frontend can render a diff and helpful feedback.",
  })
  @ApiOkEnvelope(WrittenAnswerResponseDto, {
    description: 'Written answer evaluated',
  })
  async answerWritten(
    @CurrentUser() user: IUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: SubmitWrittenAnswerDto,
  ): Promise<ResponseDto<WrittenAnswerResponseDto>> {
    const data = await this.learningService.evaluateAndSubmitWritten(
      user.id,
      sessionId,
      dto,
    );
    return { ok: true, message: 'Written answer evaluated', data };
  }

  @Get(':id/next-batch')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Fetch the next batch of Learn Mode cards',
    description:
      "Returns 7–10 non-mastered cards mixed between multiple-choice (recognition) and free-text (recall) prompts based on each card's current weighted streak. Only supported for sessions started with mode LEARN.",
  })
  @ApiOkEnvelope(LearnBatchResponseDto, { description: 'Batch retrieved' })
  async nextBatch(
    @CurrentUser() user: IUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @Query() query: GetNextBatchQueryDto,
  ): Promise<ResponseDto<LearnBatchResponseDto>> {
    const data = await this.learningService.getNextBatch(
      user.id,
      sessionId,
      query.size ?? 10,
    );
    return { ok: true, message: 'Batch retrieved', data };
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a session complete and return the summary' })
  @ApiOkEnvelope(SessionSummaryDto, { description: 'Session completed' })
  async complete(
    @CurrentUser() user: IUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
  ): Promise<ResponseDto<SessionSummaryDto>> {
    const data = await this.learningService.completeSession(user.id, sessionId);
    return { ok: true, message: 'Session completed', data };
  }
}
