import { ApiProperty } from '@nestjs/swagger';

export class ServiceHealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: 'learning' })
  service: string;

  @ApiProperty({ example: '2026-06-23T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 12345 })
  uptimeSeconds: number;
}

export const buildServiceHealth = (
  service: string,
): ServiceHealthResponseDto => ({
  status: 'ok',
  service,
  timestamp: new Date().toISOString(),
  uptimeSeconds: Math.round(process.uptime()),
});
