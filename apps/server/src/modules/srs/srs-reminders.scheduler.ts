import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  SRS_REMINDERS_QUEUE,
  SrsRemindersJob,
} from 'src/common/queue/queue.constants';

/**
 * Registers the nightly SRS reminder fan-out as a BullMQ repeatable job.
 *
 * We deliberately avoid `@nestjs/schedule` here — BullMQ already supports
 * cron-style repeats, and going through the queue means the fan-out job
 * inherits the same retry + observability we use everywhere else.
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

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('SRS_REMINDERS_DISABLED') === 'true') {
      this.logger.warn(
        'SRS reminders scheduler disabled via SRS_REMINDERS_DISABLED=true',
      );
      return;
    }

    // 03:00 UTC every day. Cheap, off-peak, and matches the "morning" spike
    // we expect once the notifications module delivers reminders.
    const cron = this.config.get<string>('SRS_REMINDERS_CRON') ?? '0 3 * * *';

    await this.queue.add(
      SrsRemindersJob.SCHEDULE_DAILY,
      {},
      {
        repeat: { pattern: cron, tz: 'UTC' },
        // Stable jobId keeps repeated boots from stacking duplicate schedules.
        jobId: 'srs-reminders-daily',
      },
    );

    this.logger.log(`SRS reminders scheduled with cron="${cron}" tz=UTC`);
  }
}
