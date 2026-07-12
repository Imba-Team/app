import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  ServiceHealthResponseDto,
  buildServiceHealth,
} from './service-health.dto';

@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOkResponse({ type: ServiceHealthResponseDto })
  rootHealth(): ServiceHealthResponseDto {
    return buildServiceHealth(process.env.SERVICE_NAME ?? 'monolith');
  }
}
