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
import {
  localHour,
  startOfLocalDayInUtc,
} from 'src/common/time/timezone.util';

const DEFAULT_REMINDER_LOCAL_HOUR = 8;

/**
 * Consumes the srs-reminders queue. Two job kinds:
 *
 * - `srs.schedule_daily`: registered as an hourly cron at boot. Each
 *   hour we look for users whose *local* time now matches the reminder
 *   hour (default 8am), and fan out one `srs.remind_user` job per
 *   such user with cards due in their local day.
 * - `srs.remind_user`: currently a stub — logs the reminder payload. The
 *   notifications module will replace the body here with a real push +
 *   in-app notification write.
 */
@Processor(SRS_REMINDERS_QUEUE, {
  concurrency: Number(process.env.SRS_REMINDERS_CONCURRENCY ?? '5'),
})
export class SrsRemindersProcessor extends WorkerHost {
  private readonly context = 'SrsRemindersProcessor';
  private readonly reminderHour: number;

  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    @InjectQueue(SRS_REMINDERS_QUEUE)
    private readonly queue: Queue<SrsRemindUserPayload | Record<string, never>>,
  ) {
    super();
    this.logger.setContext(this.context);
    const raw = Number(process.env.SRS_REMINDER_LOCAL_HOUR);
    this.reminderHour =
      Number.isInteger(raw) && raw >= 0 && raw <= 23
        ? raw
        : DEFAULT_REMINDER_LOCAL_HOUR;
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
        await this.fanOutHourly(job.id ?? 'unknown');
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

  /**
   * Runs every hour. Filters to users whose current local hour matches
   * `reminderHour`, then queues one reminder job per user with cards due
   * in *their* local day (not UTC).
   *
   * Uses two queries instead of a join: (1) all users with a
   * SRS-relevant zone touching the reminder hour right now,
   * (2) the count of their due cards. Cheap for our expected scale
   * (< 100k users); can be swapped for a raw SQL grouped query when it
   * matters.
   */
  private async fanOutHourly(jobId: string): Promise<void> {
    const now = new Date();

    // Filter users by matching their local hour against the reminder
    // hour. Doing this in JS rather than SQL avoids needing a
    // Postgres-side timezone catalog; the User table is small enough
    // that a full scan of the timezone column is fine at this scale.
    const users = await this.prisma.user.findMany({
      select: { id: true, timezone: true },
    });
    const dueUsers = users.filter(
      (u) => localHour(u.timezone ?? 'UTC', now) === this.reminderHour,
    );

    if (dueUsers.length === 0) {
      this.logger.debug(
        `[job=${jobId}] SRS hourly fan-out: no users at local hour=${this.reminderHour}`,
      );
      return;
    }

    let enqueued = 0;
    for (const user of dueUsers) {
      const dayStart = startOfLocalDayInUtc(user.timezone ?? 'UTC', now);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const dueCount = await this.prisma.srsCard.count({
        where: { userId: user.id, dueDate: { lt: dayEnd } },
      });
      if (dueCount === 0) continue;

      await this.queue.add(SrsRemindersJob.REMIND_USER, {
        userId: user.id,
        dueCount,
      });
      enqueued++;
    }

    this.logger.log(
      `[job=${jobId}] SRS hourly fan-out: hour=${this.reminderHour} ` +
        `matched=${dueUsers.length} enqueued=${enqueued}`,
    );
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
