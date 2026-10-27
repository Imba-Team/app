import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import {
  ANALYTICS_QUEUE,
  AnalyticsJob,
  AnalyticsJobName,
  AnalyticsSnapshotUserPayload,
} from 'src/common/queue/queue.constants';
import {
  addDaysToDateString,
  localDateString,
  localHour,
} from 'src/common/time/timezone.util';

import { AnalyticsService } from './analytics.service';

/**
 * Consumes the analytics queue (MIM-55). Two job kinds:
 *
 * - `analytics.snapshot_hourly`: hourly cron. Finds users whose local
 *   time is in the first hour of a new day and enqueues a snapshot of
 *   the day that just ended.
 * - `analytics.snapshot_user`: copies that user's UserSetProgress rows
 *   into user_set_progress_snapshot for the given local date (upsert).
 */
@Processor(ANALYTICS_QUEUE, {
  concurrency: Number(process.env.ANALYTICS_CONCURRENCY ?? '5'),
})
export class ProgressSnapshotProcessor extends WorkerHost {
  private readonly context = 'ProgressSnapshotProcessor';

  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    @InjectQueue(ANALYTICS_QUEUE)
    private readonly queue: Queue<
      AnalyticsSnapshotUserPayload | Record<string, never>
    >,
  ) {
    super();
    this.logger.setContext(this.context);
  }

  async process(
    job: Job<
      AnalyticsSnapshotUserPayload | Record<string, never>,
      void,
      AnalyticsJobName
    >,
  ): Promise<void> {
    switch (job.name) {
      case AnalyticsJob.SNAPSHOT_HOURLY:
        await this.fanOutHourly(job.id ?? 'unknown');
        return;
      case AnalyticsJob.SNAPSHOT_USER: {
        const { userId, date } = job.data as AnalyticsSnapshotUserPayload;
        const rows = await this.analytics.snapshotUser(userId, date);
        this.logger.debug(
          `[job=${job.id}] Snapshot userId=${userId} date=${date} rows=${rows}`,
        );
        return;
      }
      default:
        throw new UnrecoverableError(`Unknown analytics job: ${job.name}`);
    }
  }

  async fanOutHourly(jobId: string, now: Date = new Date()): Promise<number> {
    // Only users with any set progress have something to record.
    const users = await this.prisma.user.findMany({
      where: { setProgress: { some: {} } },
      select: { id: true, timezone: true },
    });

    let enqueued = 0;
    for (const user of users) {
      const tz = user.timezone ?? 'UTC';
      if (localHour(tz, now) !== 0) continue;
      const date = addDaysToDateString(localDateString(tz, now), -1);
      // Deterministic id: a retried fan-out can't double-enqueue a day.
      await this.queue.add(
        AnalyticsJob.SNAPSHOT_USER,
        { userId: user.id, date },
        { jobId: `snapshot-${user.id}-${date}` },
      );
      enqueued++;
    }

    this.logger.log(
      `[job=${jobId}] Progress snapshot fan-out: candidates=${users.length} enqueued=${enqueued}`,
    );
    return enqueued;
  }
}
