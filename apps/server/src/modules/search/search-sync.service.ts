import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import {
  SEARCH_SYNC_QUEUE,
  SearchSyncJob,
  SearchSyncJobPayload,
  searchSyncJobOptions,
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
   * Re-sync one set's search document after anything it indexes changed:
   * the set itself, its visibility, its cards, favourites or tags, or its
   * owner's username. The processor reads the canonical row from Postgres
   * and indexes or deletes accordingly, so callers never pick an action.
   */
  async enqueueSync(setId: string): Promise<void> {
    await this.queue.add(
      SearchSyncJob.SYNC_SET,
      { setId },
      searchSyncJobOptions(setId),
    );
    this.logger.debug(`enqueued SYNC_SET setId=${setId}`);
  }

  async enqueueSyncMany(setIds: Iterable<string>): Promise<void> {
    await Promise.all([...new Set(setIds)].map((id) => this.enqueueSync(id)));
  }

  /**
   * Enqueue a sync for every study set in Postgres. Used to bring the ES
   * index up to date after a mapping change, or as a one-off backfill.
   * Returns the number enqueued for the caller to log.
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

      await this.enqueueSyncMany(batch.map((row) => row.id));
      enqueued += batch.length;
      cursor = batch[batch.length - 1].id;
    }

    this.logger.log(`Full-reindex enqueued ${enqueued} study set(s)`);
    return enqueued;
  }
}
