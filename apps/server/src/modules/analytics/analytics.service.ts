import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { Redis } from 'ioredis';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { REDIS_CLIENT } from 'src/common/redis/redis.constants';
import {
  addDaysToDateString,
  isValidTimeZone,
  localDateString,
  startOfLocalDayInUtc,
} from 'src/common/time/timezone.util';

import { bucketRetention } from './domain/retention';
import { computeStreaks } from './domain/streaks';
import { ProgressRange } from './dtos/progress-query.dto';
import {
  MasteryPointDto,
  ProgressDayDto,
  ProgressResponseDto,
} from './dtos/progress-response.dto';

const PROGRESS_CACHE_TTL_SECONDS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

interface ActivityRow {
  day: string;
  answered: number;
  correct: number;
  seconds: number;
}

/** `to_char` of a UTC timestamp column as the user's local date. */
function localDay(column: string, tz: string): Prisma.Sql {
  return Prisma.sql`to_char(((${Prisma.raw(`"${column}"`)} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date, 'YYYY-MM-DD')`;
}

/**
 * A UTC instant as a naive UTC timestamp, matching how Prisma stores
 * `DateTime` columns (timestamp without time zone, in UTC) whatever the
 * session's TimeZone setting is.
 */
function utcTimestamp(date: Date): Prisma.Sql {
  return Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

/**
 * Progress analytics (MIM-17/55/56), computed from Postgres.
 *
 * A "study day" is a local calendar day (in `User.timezone`) with at
 * least one answer. Answers come from three non-overlapping sources:
 * - `card_attempt` — Flashcards / Learn / Write (SKIPPED excluded)
 * - `test_attempt` — submitted tests, via their cached counts
 * - `srs_review_log` rows with source SRS — the /srs review queue.
 *   LEARN/TEST rows are skipped here: those answers are already counted
 *   through the two sources above.
 *
 * Results are cached briefly rather than invalidated from every write
 * path; a minute of staleness is fine for a stats page.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getProgress(
    userId: string,
    days: ProgressRange,
    now: Date = new Date(),
  ): Promise<ProgressResponseDto> {
    const cacheKey = `analytics:progress:${userId}:${days}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return plainToInstance(ProgressResponseDto, JSON.parse(cached), {
          excludeExtraneousValues: true,
        });
      } catch {
        this.logger.warn(`Ignoring unreadable progress cache for ${userId}`);
      }
    }

    const timezone = await this.getTimeZone(userId);
    const today = localDateString(timezone, now);
    const firstDay = addDaysToDateString(today, -(days - 1));
    // One spare day so a DST shift can't clip the first local day; rows
    // outside [firstDay, today] are dropped when merging.
    const since = new Date(
      startOfLocalDayInUtc(timezone, now).getTime() - days * DAY_MS,
    );

    const [activityRows, studyDates, mastery, retentionRows] =
      await Promise.all([
        this.activityByDay(userId, timezone, since),
        this.studyDates(userId, timezone),
        this.masterySeries(userId, firstDay, today),
        this.retentionRows(userId, since),
      ]);

    const byDay = new Map(activityRows.map((r) => [r.day, r]));
    const activity: ProgressDayDto[] = [];
    let answered = 0;
    let correct = 0;
    let seconds = 0;
    for (let i = 0; i < days; i++) {
      const date = addDaysToDateString(firstDay, i);
      const row = byDay.get(date);
      answered += row?.answered ?? 0;
      correct += row?.correct ?? 0;
      seconds += row?.seconds ?? 0;
      activity.push({
        date,
        cardsAnswered: row?.answered ?? 0,
        correct: row?.correct ?? 0,
        minutes: Math.round((row?.seconds ?? 0) / 60),
      });
    }

    const dto = plainToInstance(
      ProgressResponseDto,
      {
        days,
        timezone,
        ...computeStreaks(studyDates, today),
        totals: {
          cardsAnswered: answered,
          correct,
          minutes: Math.round(seconds / 60),
          accuracy: answered > 0 ? correct / answered : null,
        },
        activity,
        mastery,
        retention: bucketRetention(retentionRows),
      },
      { excludeExtraneousValues: true },
    );

    await this.redis.set(
      cacheKey,
      JSON.stringify(dto),
      'EX',
      PROGRESS_CACHE_TTL_SECONDS,
    );
    return dto;
  }

  /**
   * Copy the user's current per-set counts into the snapshot table for
   * `date` (their local day). Upserts, so re-running a job is harmless.
   */
  async snapshotUser(userId: string, date: string): Promise<number> {
    return this.prisma.$executeRaw`
      INSERT INTO "user_set_progress_snapshot"
        ("userId", "setId", "date", "newCount", "learningCount", "masteredCount")
      SELECT "userId", "setId", ${date}::date, "newCount", "learningCount", "masteredCount"
      FROM "user_set_progress"
      WHERE "userId" = ${userId}::uuid
      ON CONFLICT ("userId", "setId", "date") DO UPDATE SET
        "newCount" = EXCLUDED."newCount",
        "learningCount" = EXCLUDED."learningCount",
        "masteredCount" = EXCLUDED."masteredCount"
    `;
  }

  private async getTimeZone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = user?.timezone ?? 'UTC';
    return isValidTimeZone(tz) ? tz : 'UTC';
  }

  private async activityByDay(
    userId: string,
    tz: string,
    sinceDate: Date,
  ): Promise<ActivityRow[]> {
    const day = localDay;
    const since = utcTimestamp(sinceDate);
    const rows = await this.prisma.$queryRaw<
      { day: string; answered: bigint; correct: bigint; seconds: bigint }[]
    >`
      SELECT day, SUM(answered) AS answered, SUM(correct) AS correct, SUM(seconds) AS seconds
      FROM (
        SELECT ${day('createdAt', tz)} AS day,
               COUNT(*) AS answered,
               COUNT(*) FILTER (WHERE "outcome" = 'CORRECT') AS correct,
               0 AS seconds
        FROM "card_attempt"
        WHERE "userId" = ${userId}::uuid AND "createdAt" >= ${since} AND "outcome" <> 'SKIPPED'
        GROUP BY 1
        UNION ALL
        SELECT ${day('submittedAt', tz)},
               SUM("correctCount" + "incorrectCount"),
               SUM("correctCount"),
               SUM(COALESCE("durationSeconds", 0))
        FROM "test_attempt"
        WHERE "userId" = ${userId}::uuid AND "status" = 'COMPLETED' AND "submittedAt" >= ${since}
        GROUP BY 1
        UNION ALL
        SELECT ${day('reviewedAt', tz)},
               COUNT(*),
               COUNT(*) FILTER (WHERE "rating" <> 'AGAIN'),
               0
        FROM "srs_review_log"
        WHERE "userId" = ${userId}::uuid AND "source" = 'SRS' AND "reviewedAt" >= ${since}
        GROUP BY 1
        UNION ALL
        SELECT ${day('completedAt', tz)}, 0, 0, SUM("durationSeconds")
        FROM "study_session"
        WHERE "userId" = ${userId}::uuid AND "status" = 'COMPLETED' AND "completedAt" >= ${since}
        GROUP BY 1
      ) t
      GROUP BY day
    `;
    return rows.map((r) => ({
      day: r.day,
      answered: Number(r.answered),
      correct: Number(r.correct),
      seconds: Number(r.seconds),
    }));
  }

  /** Every local day the user has answered anything, all time. */
  private async studyDates(userId: string, tz: string): Promise<string[]> {
    const day = localDay;
    const rows = await this.prisma.$queryRaw<{ day: string }[]>`
      SELECT ${day('createdAt', tz)} AS day FROM "card_attempt"
      WHERE "userId" = ${userId}::uuid AND "outcome" <> 'SKIPPED'
      UNION
      SELECT ${day('submittedAt', tz)} FROM "test_attempt"
      WHERE "userId" = ${userId}::uuid AND "status" = 'COMPLETED' AND "submittedAt" IS NOT NULL
      UNION
      SELECT ${day('reviewedAt', tz)} FROM "srs_review_log"
      WHERE "userId" = ${userId}::uuid AND "source" = 'SRS'
    `;
    return rows.map((r) => r.day);
  }

  /**
   * Nightly snapshots in range summed across sets, plus a live point for
   * today from UserSetProgress (the job only records finished days).
   */
  private async masterySeries(
    userId: string,
    firstDay: string,
    today: string,
  ): Promise<MasteryPointDto[]> {
    const [snapshots, live] = await Promise.all([
      this.prisma.userSetProgressSnapshot.groupBy({
        by: ['date'],
        where: {
          userId,
          date: { gte: new Date(`${firstDay}T00:00:00Z`) },
        },
        _sum: { newCount: true, learningCount: true, masteredCount: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.userSetProgress.aggregate({
        where: { userId },
        _sum: { newCount: true, learningCount: true, masteredCount: true },
        _count: { _all: true },
      }),
    ]);

    const points: MasteryPointDto[] = snapshots
      .map((s) => ({
        date: s.date.toISOString().slice(0, 10),
        newCount: s._sum.newCount ?? 0,
        learningCount: s._sum.learningCount ?? 0,
        masteredCount: s._sum.masteredCount ?? 0,
      }))
      .filter((p) => p.date < today);

    if (live._count._all > 0) {
      points.push({
        date: today,
        newCount: live._sum.newCount ?? 0,
        learningCount: live._sum.learningCount ?? 0,
        masteredCount: live._sum.masteredCount ?? 0,
      });
    }
    return points;
  }

  private async retentionRows(
    userId: string,
    sinceDate: Date,
  ): Promise<{ intervalBefore: number; rating: string; count: number }[]> {
    const since = utcTimestamp(sinceDate);
    const rows = await this.prisma.$queryRaw<
      { intervalBefore: number; rating: string; count: bigint }[]
    >`
      SELECT "intervalBefore", "rating", COUNT(*) AS count
      FROM "srs_review_log"
      WHERE "userId" = ${userId}::uuid AND "reviewedAt" >= ${since} AND "intervalBefore" > 0
      GROUP BY 1, 2
    `;
    return rows.map((r) => ({ ...r, count: Number(r.count) }));
  }
}
