import { Controller, Get, HttpCode, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiOkEnvelope } from 'src/common/decorators/api-envelope.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { AnalyticsService } from './analytics.service';
import { ProgressQueryDto } from './dtos/progress-query.dto';
import { ProgressResponseDto } from './dtos/progress-response.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('analytics')
export class ProgressController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('me/progress')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get my study progress',
    description:
      'Current and best study streak, per-day activity for the last `days` days (30 or 90), mastery over time and retention by review interval. Days are local to the user’s saved timezone.',
  })
  @ApiOkEnvelope(ProgressResponseDto, { description: 'Progress retrieved' })
  async getMyProgress(
    @CurrentUser() user: IUser,
    @Query() query: ProgressQueryDto,
  ): Promise<ResponseDto<ProgressResponseDto>> {
    const data = await this.analytics.getProgress(user.id, query.days ?? 30);
    return { ok: true, message: 'Progress retrieved', data };
  }
}
