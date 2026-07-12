import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  ServiceHealthResponseDto,
  buildServiceHealth,
} from 'src/common/health/service-health.dto';

@ApiTags('analytics')
@Controller('services/analytics')
export class AnalyticsController {
  @Get('health')
  @ApiOkResponse({ type: ServiceHealthResponseDto })
  health(): ServiceHealthResponseDto {
    return buildServiceHealth('analytics');
  }
}
