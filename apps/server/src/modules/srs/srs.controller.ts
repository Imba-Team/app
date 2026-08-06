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
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import {
  ApiOkEnvelope,
} from 'src/common/decorators/api-envelope.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import {
  ServiceHealthResponseDto,
  buildServiceHealth,
} from 'src/common/health/service-health.dto';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import {
  ForecastQueryDto,
  ForecastResponseDto,
} from './dtos/forecast.dto';
import { QueueQueryDto } from './dtos/queue-query.dto';
import { ReviewSrsCardDto } from './dtos/review-srs-card.dto';
import { SrsCardDto } from './dtos/srs-card.dto';
import { SrsReviewResponseDto } from './dtos/srs-review-response.dto';
import { SrsService } from './srs.service';

@ApiTags('srs')
@Controller()
export class SrsController {
  constructor(private readonly srsService: SrsService) {}

  @Get('services/srs/health')
  @ApiOkResponse({ type: ServiceHealthResponseDto })
  health(): ServiceHealthResponseDto {
    return buildServiceHealth('srs');
  }

  @Get('srs/queue/today')
  @HttpCode(200)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.USER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List today's due SRS cards for the caller",
    description:
      'Includes overdue cards. Ordered by dueDate ascending. "Today" respects the user\'s saved timezone (defaults to UTC).',
  })
  @ApiOkEnvelope(SrsCardDto, {
    isArray: true,
    description: 'Due queue retrieved',
  })
  async todayQueue(
    @CurrentUser() user: IUser,
    @Query() query: QueueQueryDto,
  ): Promise<ResponseDto<SrsCardDto[]>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const { items, total } = await this.srsService.getTodayQueue(
      user.id,
      limit,
      offset,
    );
    return {
      ok: true,
      message: 'Due queue retrieved',
      data: items,
      meta: {
        total,
        limit,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Post('srs/cards/:id/review')
  @HttpCode(200)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.USER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Submit a rating for a due SRS card',
    description:
      'Runs SM-2 with the given rating, updates the card, and returns the new schedule plus remaining-due count for today.',
  })
  @ApiOkEnvelope(SrsReviewResponseDto, { description: 'Review applied' })
  async review(
    @CurrentUser() user: IUser,
    @Param('id', new ParseUUIDPipe()) srsCardId: string,
    @Body() dto: ReviewSrsCardDto,
  ): Promise<ResponseDto<SrsReviewResponseDto>> {
    const data = await this.srsService.review(user.id, srsCardId, dto);
    return { ok: true, message: 'Review applied', data };
  }

  @Get('srs/forecast')
  @HttpCode(200)
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.USER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get a per-day forecast of due SRS cards',
    description:
      "Returns one bucket per day for the next `days` days (default 30). Overdue cards fold into today's bucket.",
  })
  @ApiOkEnvelope(ForecastResponseDto, { description: 'Forecast retrieved' })
  async forecast(
    @CurrentUser() user: IUser,
    @Query() query: ForecastQueryDto,
  ): Promise<ResponseDto<ForecastResponseDto>> {
    const data = await this.srsService.getForecast(user.id, query.days ?? 30);
    return { ok: true, message: 'Forecast retrieved', data };
  }
}
