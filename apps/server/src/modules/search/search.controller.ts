import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ApiOkEnvelope } from 'src/common/decorators/api-envelope.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import {
  ServiceHealthResponseDto,
  buildServiceHealth,
} from 'src/common/health/service-health.dto';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { SearchSetsQueryDto } from './dto/search-sets.dto';
import { SearchSetsResponseDto } from './dto/search-result.dto';
import { SearchService } from './search.service';
import { SearchSyncService } from './search-sync.service';

@ApiTags('Search')
@Controller()
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly searchSync: SearchSyncService,
  ) {}

  @Get('services/search/health')
  @ApiOkResponse({ type: ServiceHealthResponseDto })
  health(): ServiceHealthResponseDto {
    return buildServiceHealth('search');
  }

  @Get('search/sets')
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.USER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Search public study sets via Elasticsearch (title^3 + tags^2 + description, fuzziness AUTO).',
  })
  @ApiOkEnvelope(SearchSetsResponseDto, { description: 'Search results' })
  async searchSets(
    @Query() query: SearchSetsQueryDto,
  ): Promise<ResponseDto<SearchSetsResponseDto>> {
    const data = await this.searchService.searchSets(query);
    return { ok: true, message: 'Search results', data };
  }

  @Post('search/admin/reindex-all')
  @HttpCode(202)
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Enqueue an INDEX_SET job for every study set in Postgres. ' +
      'Admin only. Used to backfill after a mapping change or when ' +
      'sync-on-write was introduced.',
  })
  async reindexAll(): Promise<
    ResponseDto<{ enqueued: number }>
  > {
    const enqueued = await this.searchSync.enqueueReindexAllSets();
    return {
      ok: true,
      message: `Enqueued ${enqueued} set(s) for reindex`,
      data: { enqueued },
    };
  }
}
