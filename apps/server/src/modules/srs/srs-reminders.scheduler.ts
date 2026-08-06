import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  SRS_REMINDERS_QUEUE,
  SrsRemindersJob,
} from 'src/common/queue/queue.constants';

const SCHEDULER_ID = 'srs-reminders-daily';

/**
 * Registers the nightly SRS reminder fan-out as a BullMQ repeatable job.
 *
 * We deliberately avoid `@nestjs/schedule` here — BullMQ already supports
 * cron-style repeats, and going through the queue means the fan-out job
 * inherits the same retry + observability we use everywhere else.
 *
 * Registration is fire-and-forget: `onModuleInit` must never block the
 * app from binding to its port, even if Redis is briefly slow or the
 * BullMQ handshake stalls. A missed schedule is recoverable on the next
 * boot; a stuck `app.listen()` is not.
 */
@Injectable()
export class SrsRemindersScheduler implements OnModuleInit {
  private readonly context = 'SrsRemindersScheduler';

  constructor(
    @InjectQueue(SRS_REMINDERS_QUEUE) private readonly queue: Queue,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
  ) {
    this.logger.setContext(this.context);
  }

  onModuleInit(): void {
    if (this.config.get<string>('SRS_REMINDERS_DISABLED') === 'true') {
      this.logger.warn(
        'SRS reminders scheduler disabled via SRS_REMINDERS_DISABLED=true',
      );
      return;
    }

    // Fire every hour on the hour, UTC. The processor picks out the
    // users whose *local* hour matches SRS_REMINDER_LOCAL_HOUR (default
    // 8). This gives us per-user reminder timing without maintaining
    // 24 separate schedulers, and delivery volume is naturally smeared
    // across the day rather than spiking once at 03:00 UTC.
    const cron = this.config.get<string>('SRS_REMINDERS_CRON') ?? '0 * * * *';

    // Fire-and-forget. `upsertJobScheduler` is idempotent — same
    // schedulerId replaces the entry, so repeated boots don't stack
    // duplicates.
    this.queue
      .upsertJobScheduler(
        SCHEDULER_ID,
        { pattern: cron, tz: 'UTC' },
        { name: SrsRemindersJob.SCHEDULE_DAILY, data: {} },
      )
      .then(() => {
        this.logger.log(`SRS reminders scheduled with cron="${cron}" tz=UTC`);
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `Failed to register SRS reminders scheduler: ${
            err instanceof Error ? err.message : String(err)
          }. Will retry on next boot.`,
        );
      });
  }
}
