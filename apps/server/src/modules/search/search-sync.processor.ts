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
      case SearchSyncJob.INDEX_SET:
        await this.searchService.indexSet(setId);
        this.logger.log(`[job=${job.id}] indexed setId=${setId}`);
        return;
      case SearchSyncJob.DELETE_SET:
        await this.searchService.deleteSet(setId);
        this.logger.log(`[job=${job.id}] deleted setId=${setId}`);
        return;
      default:
        throw new UnrecoverableError(`Unknown search-sync job: ${job.name}`);
    }
  }
}
