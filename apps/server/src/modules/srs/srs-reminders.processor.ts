import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import {
  SRS_REMINDERS_QUEUE,
  SrsRemindersJob,
  SrsRemindersJobName,
  SrsRemindUserPayload,
} from 'src/common/queue/queue.constants';

/**
 * Consumes the srs-reminders queue. Two job kinds:
 *
 * - `srs.schedule_daily`: registered as a repeatable job at boot. Fans out
 *   one `srs.remind_user` job per user with cards due today.
 * - `srs.remind_user`: currently a stub — logs the reminder payload. The
 *   Sprint 7 notifications module will replace the body here with a real
 *   push + in-app notification write.
 */
@Processor(SRS_REMINDERS_QUEUE, {
  concurrency: Number(process.env.SRS_REMINDERS_CONCURRENCY ?? '5'),
})
export class SrsRemindersProcessor extends WorkerHost {
  private readonly context = 'SrsRemindersProcessor';

  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    @InjectQueue(SRS_REMINDERS_QUEUE)
    private readonly queue: Queue<SrsRemindUserPayload | Record<string, never>>,
  ) {
    super();
    this.logger.setContext(this.context);
  }

  async process(
    job: Job<
      SrsRemindUserPayload | Record<string, never>,
      void,
      SrsRemindersJobName
    >,
  ): Promise<void> {
    switch (job.name) {
      case SrsRemindersJob.SCHEDULE_DAILY:
        await this.fanOutDaily(job.id ?? 'unknown');
        return;
      case SrsRemindersJob.REMIND_USER:
        await this.remindUser(
          job.id ?? 'unknown',
          job.data as SrsRemindUserPayload,
        );
        return;
      default:
        throw new UnrecoverableError(`Unknown srs-reminders job: ${job.name}`);
    }
  }

  private async fanOutDaily(jobId: string): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const upperBound = new Date(today);
    upperBound.setUTCDate(upperBound.getUTCDate() + 1);

    const rows = await this.prisma.srsCard.groupBy({
      by: ['userId'],
      where: { dueDate: { lt: upperBound } },
      _count: { _all: true },
    });

    this.logger.log(
      `[job=${jobId}] SRS daily fan-out: ${rows.length} user(s) with due cards`,
    );

    for (const row of rows) {
      await this.queue.add(SrsRemindersJob.REMIND_USER, {
        userId: row.userId,
        dueCount: row._count._all,
      });
    }
  }

  private async remindUser(
    jobId: string,
    payload: SrsRemindUserPayload,
  ): Promise<void> {
    // Sprint 7 will replace this with real delivery via the notifications
    // module. Kept as a log-only stub so the plumbing runs end-to-end and
    // Grafana can chart fan-out volume today.
    this.logger.log(
      `[job=${jobId}] SRS reminder (stub) userId=${payload.userId} dueCount=${payload.dueCount}`,
    );
  }
}
