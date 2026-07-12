import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  ServiceHealthResponseDto,
  buildServiceHealth,
} from 'src/common/health/service-health.dto';

@ApiTags('ai')
@Controller('services/ai')
export class AiController {
  @Get('health')
  @ApiOkResponse({ type: ServiceHealthResponseDto })
  health(): ServiceHealthResponseDto {
    return buildServiceHealth('ai');
  }
}
