import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  MAIL_QUEUE,
  MailJob,
  MailJobPayload,
} from 'src/common/queue/queue.constants';

@Injectable()
export class MailQueueService {
  private readonly context = 'MailQueueService';

  constructor(
    @InjectQueue(MAIL_QUEUE) private readonly queue: Queue<MailJobPayload>,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(this.context);
  }

  /**
   * Enqueue an outbound email. Returns immediately once the job is
   * persisted in Redis — actual delivery happens in MailProcessor.
   */
  async enqueue(payload: MailJobPayload): Promise<string | undefined> {
    const job = await this.queue.add(MailJob.SEND, payload, {
      jobId: undefined,
    });
    this.logger.debug(
      `[job=${job.id}] enqueued mail to=${payload.to} ` +
        `subject="${payload.subject}" context=${payload.context ?? 'n/a'}`,
    );
    return job.id;
  }

  /**
   * Lightweight observability helper — exposes queue counts so a future
   * /services/notification/mail/stats endpoint can publish them.
   */
  async stats(): Promise<{
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    completed: number;
  }> {
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
      'completed',
    );
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
    };
  }
}
