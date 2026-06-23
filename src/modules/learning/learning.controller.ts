import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  ServiceHealthResponseDto,
  buildServiceHealth,
} from 'src/common/health/service-health.dto';

@ApiTags('learning')
@Controller('services/learning')
export class LearningController {
  @Get('health')
  @ApiOkResponse({ type: ServiceHealthResponseDto })
  health(): ServiceHealthResponseDto {
    return buildServiceHealth('learning');
  }
}
