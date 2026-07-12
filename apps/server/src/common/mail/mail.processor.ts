import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job, UnrecoverableError } from 'bullmq';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  MAIL_QUEUE,
  MailJob,
  MailJobName,
  MailJobPayload,
} from 'src/common/queue/queue.constants';
import { MailService } from './mail.service';

@Processor(MAIL_QUEUE, {
  concurrency: Number(process.env.MAIL_QUEUE_CONCURRENCY ?? '5'),
})
export class MailProcessor extends WorkerHost {
  private readonly context = 'MailProcessor';

  constructor(
    private readonly mailService: MailService,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
  ) {
    super();
    this.logger.setContext(this.context);
  }

  async process(job: Job<MailJobPayload, void, MailJobName>): Promise<void> {
    if (job.name !== MailJob.SEND) {
      // Unknown job names are an unrecoverable programming error — drop fast.
      throw new UnrecoverableError(`Unknown mail job: ${job.name}`);
    }

    const { to, subject, context } = job.data;
    this.logger.log(
      `[job=${job.id}] sending mail to=${to} subject="${subject}" ` +
        `attempt=${job.attemptsMade + 1}/${job.opts.attempts ?? 1} ` +
        `context=${context ?? 'n/a'}`,
    );

    const ok = await this.mailService.deliver(job.data);

    if (!ok) {
      // sendMail returned false — likely missing config or transient SMTP
      // error. Throwing lets BullMQ apply backoff + retry.
      throw new Error(`Mail delivery failed for ${to} (subject="${subject}")`);
    }

    this.logger.log(`[job=${job.id}] delivered to=${to}`);
  }
}
