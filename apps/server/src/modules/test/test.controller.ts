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

import { ListTestHistoryQueryDto } from './dtos/list-test-history-query.dto';
import { StartTestAttemptDto } from './dtos/start-test-attempt.dto';
import { StartTestAttemptResponseDto } from './dtos/start-test-attempt-response.dto';
import { SubmitTestAttemptDto } from './dtos/submit-test-attempt.dto';
import { TestAttemptResultDto } from './dtos/test-attempt-result.dto';
import { TestHistoryItemDto } from './dtos/test-history-item.dto';
import { TestService } from './test.service';

@ApiTags('Test')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('test-attempts')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Start a test attempt',
    description:
      "Generates questions server-side per the caller's TestPreferences and persists the attempt in IN_PROGRESS status. If the caller already has an IN_PROGRESS attempt for this set, returns that one with resumed=true instead of creating a duplicate. Question responses omit correct answers — the server grades on submit.",
  })
  @ApiCreatedEnvelope(StartTestAttemptResponseDto, {
    description: 'Test attempt started',
  })
  async start(
    @CurrentUser() user: IUser,
    @Body() dto: StartTestAttemptDto,
  ): Promise<ResponseDto<StartTestAttemptResponseDto>> {
    const data = await this.testService.startAttempt(user.id, dto);
    return { ok: true, message: 'Test attempt started', data };
  }

  @Post(':id/submit')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Submit answers and grade a test attempt',
    description:
      "Grades every question using the caller's strictness preference, updates SRS per card touch, and returns the full graded result (per-question review + score). Idempotent guard: submitting an already-COMPLETED attempt returns 409.",
  })
  @ApiOkEnvelope(TestAttemptResultDto, {
    description: 'Test attempt graded',
  })
  async submit(
    @CurrentUser() user: IUser,
    @Param('id', new ParseUUIDPipe()) attemptId: string,
    @Body() dto: SubmitTestAttemptDto,
  ): Promise<ResponseDto<TestAttemptResultDto>> {
    const data = await this.testService.submitAttempt(user.id, attemptId, dto);
    return { ok: true, message: 'Test attempt graded', data };
  }

  @Post(':id/abandon')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Abandon an in-progress test attempt',
    description:
      'Flips an IN_PROGRESS attempt to ABANDONED so the concurrent-attempt guard on POST /test-attempts lets a new one through. Noop on COMPLETED / ABANDONED attempts.',
  })
  async abandon(
    @CurrentUser() user: IUser,
    @Param('id', new ParseUUIDPipe()) attemptId: string,
  ): Promise<void> {
    await this.testService.abandonAttempt(user.id, attemptId);
  }

  @Get()
  @HttpCode(200)
  @ApiOperation({
    summary: 'List my test attempts',
    description:
      'Paginated, newest-first. Optionally filter by studySetId to power the set-page history.',
  })
  @ApiOkEnvelope(TestHistoryItemDto, {
    isArray: true,
    description: 'Test history retrieved',
  })
  async list(
    @CurrentUser() user: IUser,
    @Query() query: ListTestHistoryQueryDto,
  ): Promise<ResponseDto<TestHistoryItemDto[]>> {
    const { items, total, limit, offset } = await this.testService.listAttempts(
      user.id,
      query,
    );
    return {
      ok: true,
      message: 'Test history retrieved',
      data: items,
      meta: {
        total,
        limit,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':id')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get a single test attempt with per-question review',
    description:
      'Returns everything the review page needs: score, counters, per-question graded rows including correct answers, and matching pair judgments.',
  })
  @ApiOkEnvelope(TestAttemptResultDto, {
    description: 'Test attempt retrieved',
  })
  async get(
    @CurrentUser() user: IUser,
    @Param('id', new ParseUUIDPipe()) attemptId: string,
  ): Promise<ResponseDto<TestAttemptResultDto>> {
    const data = await this.testService.getAttempt(user.id, attemptId);
    return { ok: true, message: 'Test attempt retrieved', data };
  }
}
