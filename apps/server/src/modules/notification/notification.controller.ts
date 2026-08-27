import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  ServiceHealthResponseDto,
  buildServiceHealth,
} from 'src/common/health/service-health.dto';

@ApiTags('notification')
@Controller('services/notification')
export class NotificationController {
  @Get('health')
  @ApiOkResponse({ type: ServiceHealthResponseDto })
  health(): ServiceHealthResponseDto {
    return buildServiceHealth('notification');
  }
}
