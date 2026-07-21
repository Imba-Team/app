import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { LoggerService } from 'src/common/logger/logger.service';
import {
  SEARCH_SYNC_QUEUE,
  SearchSyncJob,
  SearchSyncJobPayload,
} from 'src/common/queue/queue.constants';

@Injectable()
export class SearchSyncService {
  constructor(
    @InjectQueue(SEARCH_SYNC_QUEUE)
    private readonly queue: Queue<SearchSyncJobPayload>,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(SearchSyncService.name);
  }

  /**
   * Re-index a single set. Safe to call on create, update, and visibility
   * changes — the processor reads the canonical row from Postgres. Using
   * setId as the jobId deduplicates rapid bursts (e.g. multiple PATCHes
   * within the queue's window) into a single re-index.
   */
  async enqueueIndex(setId: string): Promise<void> {
    // BullMQ >=5 rejects ":" in custom job IDs (reserved as key separator).
    await this.queue.add(
      SearchSyncJob.INDEX_SET,
      { setId },
      { jobId: `index-${setId}` },
    );
    this.logger.debug(`enqueued INDEX_SET setId=${setId}`);
  }

  async enqueueDelete(setId: string): Promise<void> {
    await this.queue.add(
      SearchSyncJob.DELETE_SET,
      { setId },
      { jobId: `delete-${setId}` },
    );
    this.logger.debug(`enqueued DELETE_SET setId=${setId}`);
  }
}
