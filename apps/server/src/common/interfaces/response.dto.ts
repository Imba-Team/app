import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Canonical API response envelope. All controllers return this shape so the
 * client can rely on a single unwrap contract.
 *
 * Kept as a class (not an interface) so Swagger can register it as a schema
 * and use it as the outer $ref in typed response decorators.
 */
export class ResponseDto<T = unknown> {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ example: 'Operation successful' })
  message!: string;

  @ApiPropertyOptional()
  data?: T;

  @ApiPropertyOptional()
  error?: string;

  @ApiPropertyOptional()
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}
