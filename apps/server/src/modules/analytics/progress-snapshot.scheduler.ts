import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  ANALYTICS_QUEUE,
  AnalyticsJob,
} from 'src/common/queue/queue.constants';

const SCHEDULER_ID = 'analytics-progress-snapshots';

/**
 * Registers the hourly mastery-snapshot fan-out (MIM-55) as a BullMQ
 * repeatable job. Same shape as SrsRemindersScheduler: fire-and-forget
 * so a slow Redis never blocks boot, and idempotent via the scheduler id.
 */
@Injectable()
export class ProgressSnapshotScheduler implements OnModuleInit {
  private readonly context = 'ProgressSnapshotScheduler';

  constructor(
    @InjectQueue(ANALYTICS_QUEUE) private readonly queue: Queue,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
  ) {
    this.logger.setContext(this.context);
  }

  onModuleInit(): void {
    if (this.config.get<string>('ANALYTICS_SNAPSHOTS_DISABLED') === 'true') {
      this.logger.warn(
        'Progress snapshots disabled via ANALYTICS_SNAPSHOTS_DISABLED=true',
      );
      return;
    }

    // Hourly in UTC; the processor picks the users whose local day just
    // rolled over, so each user is snapshotted once per local day.
    const cron =
      this.config.get<string>('ANALYTICS_SNAPSHOT_CRON') ?? '5 * * * *';

    this.queue
      .upsertJobScheduler(
        SCHEDULER_ID,
        { pattern: cron, tz: 'UTC' },
        { name: AnalyticsJob.SNAPSHOT_HOURLY, data: {} },
      )
      .then(() => {
        this.logger.log(
          `Progress snapshots scheduled with cron="${cron}" tz=UTC`,
        );
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `Failed to register progress snapshot scheduler: ${
            err instanceof Error ? err.message : String(err)
          }. Will retry on next boot.`,
        );
      });
  }
}
