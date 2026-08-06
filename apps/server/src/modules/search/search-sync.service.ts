import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import {
  SEARCH_SYNC_QUEUE,
  SearchSyncJob,
  SearchSyncJobPayload,
} from 'src/common/queue/queue.constants';

const REINDEX_BATCH_SIZE = 500;

@Injectable()
export class SearchSyncService {
  constructor(
    @InjectQueue(SEARCH_SYNC_QUEUE)
    private readonly queue: Queue<SearchSyncJobPayload>,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
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

  /**
   * Enqueue an INDEX_SET job for every study set in Postgres. Used to
   * bring the ES index up to date after a mapping change or after
   * introducing sync-on-write (any rows created before that point have
   * no index entry).
   *
   * Idempotent: each job carries `jobId=index-<setId>`, so re-running
   * while jobs from a previous invocation are still in the queue folds
   * duplicates. Returns the number enqueued for the caller to log.
   */
  async enqueueReindexAllSets(): Promise<number> {
    let cursor: string | undefined;
    let enqueued = 0;

    for (;;) {
      const batch = await this.prisma.studySet.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
        take: REINDEX_BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;

      await Promise.all(batch.map((row) => this.enqueueIndex(row.id)));
      enqueued += batch.length;
      cursor = batch[batch.length - 1].id;
    }

    this.logger.log(`Full-reindex enqueued ${enqueued} study set(s)`);
    return enqueued;
  }
}
