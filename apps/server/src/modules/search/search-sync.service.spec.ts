import { Queue } from 'bullmq';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SearchSyncJobPayload } from 'src/common/queue/queue.constants';

import { SearchSyncService } from './search-sync.service';

const noopLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as LoggerService;

const build = (setIds: string[] = []) => {
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const prisma = {
    studySet: {
      // Two pages of ids, then empty — exercises the cursor loop.
      findMany: jest
        .fn()
        .mockResolvedValueOnce(setIds.slice(0, 2).map((id) => ({ id })))
        .mockResolvedValueOnce(setIds.slice(2).map((id) => ({ id })))
        .mockResolvedValue([]),
    },
  };
  const svc = new SearchSyncService(
    queue as unknown as Queue<SearchSyncJobPayload>,
    noopLogger(),
    prisma as unknown as PrismaService,
  );
  return { svc, queue, prisma };
};

describe('SearchSyncService (MIM-45)', () => {
  it('enqueues a per-set deduplicated sync job, never a fixed jobId', async () => {
    const { svc, queue } = build();

    await svc.enqueueSync('set-1');

    expect(queue.add).toHaveBeenCalledWith(
      'search.sync_set',
      { setId: 'set-1' },
      { deduplication: { id: 'set-set-1', keepLastIfActive: true } },
    );
    const [, , opts] = queue.add.mock.calls[0] as [unknown, unknown, object];
    expect(opts).not.toHaveProperty('jobId');
  });

  it('enqueueSyncMany syncs each distinct set once', async () => {
    const { svc, queue } = build();

    await svc.enqueueSyncMany(['a', 'b', 'a']);

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(
      queue.add.mock.calls.map(
        (c) => (c as [string, { setId: string }])[1].setId,
      ),
    ).toEqual(['a', 'b']);
  });

  it('reindex-all pages through every set', async () => {
    const { svc, queue } = build(['a', 'b', 'c']);

    expect(await svc.enqueueReindexAllSets()).toBe(3);
    expect(queue.add).toHaveBeenCalledTimes(3);
  });
});
