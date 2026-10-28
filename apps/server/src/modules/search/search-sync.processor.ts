import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';

import { LoggerService } from 'src/common/logger/logger.service';
import {
  SEARCH_SYNC_QUEUE,
  SearchSyncJob,
  SearchSyncJobName,
  SearchSyncJobPayload,
} from 'src/common/queue/queue.constants';

import { SearchService } from './search.service';

@Processor(SEARCH_SYNC_QUEUE, {
  concurrency: Number(process.env.SEARCH_SYNC_CONCURRENCY ?? '4'),
})
export class SearchSyncProcessor extends WorkerHost {
  constructor(
    private readonly searchService: SearchService,
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext(SearchSyncProcessor.name);
  }

  async process(
    job: Job<SearchSyncJobPayload, void, SearchSyncJobName>,
  ): Promise<void> {
    const { setId } = job.data;
    switch (job.name) {
      // INDEX_SET / DELETE_SET are legacy names: the sync reads Postgres,
      // so it does the right thing for jobs queued before the switch too.
      case SearchSyncJob.SYNC_SET:
      case SearchSyncJob.INDEX_SET:
      case SearchSyncJob.DELETE_SET: {
        const action = await this.searchService.syncSet(setId);
        this.logger.log(`[job=${job.id}] ${action} setId=${setId}`);
        return;
      }
      default:
        throw new UnrecoverableError(`Unknown search-sync job: ${job.name}`);
    }
  }
}
