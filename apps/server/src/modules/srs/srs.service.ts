import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { Redis } from 'ioredis';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { REDIS_CLIENT } from 'src/common/redis/redis.constants';

import { ForecastBucketDto, ForecastResponseDto } from './dtos/forecast.dto';
import { ReviewSrsCardDto } from './dtos/review-srs-card.dto';
import { SrsCardDto } from './dtos/srs-card.dto';
import { SrsReviewResponseDto } from './dtos/srs-review-response.dto';
import { NEW_SRS_CARD, processReview, Sm2Rating } from './domain/sm2';
import { startOfLocalDayInUtc } from 'src/common/time/timezone.util';

const IDEMPOTENCY_TTL_SECONDS = 300;

/**
 * SRS = Spaced Repetition Scheduler. Wraps the pure SM-2 function
 * ([sm2.ts](./domain/sm2.ts)) with the persistence + HTTP query layer.
 *
 * "Today" is per-user local: `getUserDayStart(userId)` reads the saved
 * `User.timezone` and returns the UTC instant matching that user's
 * local midnight. Cards created without a saved timezone default to
 * UTC via the DB column default.
 */
@Injectable()
export class SrsService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private static addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  private static toDateString(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * UTC instant matching 00:00 local for the given user. Falls back to
   * UTC midnight if the user has no saved zone (shouldn't happen — the
   * column has a DB default — but safe against a stray null).
   *
   * Public so LearningService can precompute the day boundary once and
   * pass it into `applyReviewByCard` — the review path runs inside a
   * transaction and shouldn't spawn its own prisma reads.
   */
  async getUserDayStart(userId: string, now: Date = new Date()): Promise<Date> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return startOfLocalDayInUtc(user?.timezone ?? 'UTC', now);
  }

  /**
   * Cross-service entry point for Learn Mode. Upserts the SrsCard row
   * for `(userId, cardId)` if it doesn't exist yet, applies SM-2 with
   * the given rating, and writes the new schedule. Called inside the
   * Learn transaction so the mastery write, the CardAttempt log, and
   * the SRS update all commit together.
   *
   * Returns the updated schedule so the learning service can log or
   * echo it downstream — the frontend doesn't currently use it.
   */
  async applyReviewByCard(
    tx: Prisma.TransactionClient,
    userId: string,
    cardId: string,
    rating: Sm2Rating,
    today: Date,
    now: Date = new Date(),
  ): Promise<{
    intervalDays: number;
    dueDate: Date;
    easeFactor: number;
    lapses: number;
    isLeech: boolean;
    repetitions: number;
    firstReview: boolean;
  }> {
    const existing = await tx.srsCard.findUnique({
      where: { userId_cardId: { userId, cardId } },
    });

    const state = existing
      ? {
          easeFactor: Number(existing.easeFactor),
          intervalDays: existing.intervalDays,
          repetitions: existing.repetitions,
          lapses: existing.lapses,
        }
      : NEW_SRS_CARD;

    const next = processReview(state, rating);
    const nextDue = SrsService.addDays(today, next.intervalDays);

    const write = {
      easeFactor: new Prisma.Decimal(next.easeFactor.toFixed(2)),
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      lapses: next.lapses,
      isLeech: next.isLeech,
      dueDate: nextDue,
      lastReviewed: now,
    };

    await tx.srsCard.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: { userId, cardId, ...write },
      update: write,
    });

    return {
      intervalDays: next.intervalDays,
      dueDate: nextDue,
      easeFactor: next.easeFactor,
      lapses: next.lapses,
      isLeech: next.isLeech,
      repetitions: next.repetitions,
      firstReview: !existing,
    };
  }

  /**
   * Cards due today (in the user's local day) for a specific set.
   * Powers the "cards due today" affordance on the module page and the
   * due-first pull in Learn Mode.
   */
  async getDueQueueForSet(
    userId: string,
    setId: string,
    limit = 50,
  ): Promise<{ items: SrsCardDto[]; total: number }> {
    const today = await this.getUserDayStart(userId);
    const upperBound = SrsService.addDays(today, 1);

    const where: Prisma.SrsCardWhereInput = {
      userId,
      dueDate: { lt: upperBound },
      card: { studySetId: setId },
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.srsCard.findMany({
        where,
        include: {
          card: {
            select: {
              id: true,
              term: true,
              definition: true,
              hint: true,
              studySetId: true,
            },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        take: limit,
      }),
      this.prisma.srsCard.count({ where }),
    ]);

    const items = rows.map((row) =>
      plainToInstance(
        SrsCardDto,
        {
          id: row.id,
          cardId: row.cardId,
          studySetId: row.card.studySetId,
          term: row.card.term,
          definition: row.card.definition,
          hint: row.card.hint,
          easeFactor: row.easeFactor.toString(),
          intervalDays: row.intervalDays,
          repetitions: row.repetitions,
          lapses: row.lapses,
          dueDate: SrsService.toDateString(row.dueDate),
          lastReviewed: row.lastReviewed,
          isLeech: row.isLeech,
        },
        { excludeExtraneousValues: true },
      ),
    );

    return { items, total };
  }

  async getTodayQueue(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ items: SrsCardDto[]; total: number }> {
    const today = await this.getUserDayStart(userId);
    const upperBound = SrsService.addDays(today, 1);

    const where: Prisma.SrsCardWhereInput = {
      userId,
      dueDate: { lt: upperBound },
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.srsCard.findMany({
        where,
        include: {
          card: {
            select: {
              id: true,
              term: true,
              definition: true,
              hint: true,
              studySetId: true,
            },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.srsCard.count({ where }),
    ]);

    const items = rows.map((row) =>
      plainToInstance(
        SrsCardDto,
        {
          id: row.id,
          cardId: row.cardId,
          studySetId: row.card.studySetId,
          term: row.card.term,
          definition: row.card.definition,
          hint: row.card.hint,
          easeFactor: row.easeFactor.toString(),
          intervalDays: row.intervalDays,
          repetitions: row.repetitions,
          lapses: row.lapses,
          dueDate: SrsService.toDateString(row.dueDate),
          lastReviewed: row.lastReviewed,
          isLeech: row.isLeech,
        },
        { excludeExtraneousValues: true },
      ),
    );

    return { items, total };
  }

  async review(
    userId: string,
    srsCardId: string,
    dto: ReviewSrsCardDto,
  ): Promise<SrsReviewResponseDto> {
    const cached = await this.readIdempotentResponse(dto.attemptId);
    if (cached) return cached;

    const applied = await this.applyReview(userId, srsCardId, dto.rating);
    await this.storeIdempotentResponse(dto.attemptId, applied);
    return applied;
  }

  private async applyReview(
    userId: string,
    srsCardId: string,
    rating: Sm2Rating,
  ): Promise<SrsReviewResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.srsCard.findUnique({
        where: { id: srsCardId },
        include: {
          card: {
            select: {
              id: true,
              term: true,
              definition: true,
              hint: true,
              studySetId: true,
            },
          },
        },
      });
      if (!row) throw new NotFoundException('SRS card not found');
      if (row.userId !== userId) {
        throw new ForbiddenException('Not your SRS card');
      }

      const next = processReview(
        {
          easeFactor: Number(row.easeFactor),
          intervalDays: row.intervalDays,
          repetitions: row.repetitions,
          lapses: row.lapses,
        },
        rating,
      );

      const now = new Date();
      const today = await this.getUserDayStart(userId, now);
      const nextDue = SrsService.addDays(today, next.intervalDays);

      const updated = await tx.srsCard.update({
        where: { id: srsCardId },
        data: {
          easeFactor: new Prisma.Decimal(next.easeFactor.toFixed(2)),
          intervalDays: next.intervalDays,
          repetitions: next.repetitions,
          lapses: next.lapses,
          isLeech: next.isLeech,
          dueDate: nextDue,
          lastReviewed: now,
        },
      });

      const remainingDueToday = await tx.srsCard.count({
        where: {
          userId,
          dueDate: { lt: SrsService.addDays(today, 1) },
        },
      });

      this.logger.log(
        `SRS review applied: userId=${userId} srsCardId=${srsCardId} ` +
          `rating=${rating} intervalDays=${next.intervalDays} ` +
          `dueDate=${SrsService.toDateString(nextDue)}`,
      );

      return plainToInstance(
        SrsReviewResponseDto,
        {
          card: plainToInstance(
            SrsCardDto,
            {
              id: updated.id,
              cardId: updated.cardId,
              studySetId: row.card.studySetId,
              term: row.card.term,
              definition: row.card.definition,
              hint: row.card.hint,
              easeFactor: updated.easeFactor.toString(),
              intervalDays: updated.intervalDays,
              repetitions: updated.repetitions,
              lapses: updated.lapses,
              dueDate: SrsService.toDateString(updated.dueDate),
              lastReviewed: updated.lastReviewed,
              isLeech: updated.isLeech,
            },
            { excludeExtraneousValues: true },
          ),
          remainingDueToday,
        },
        { excludeExtraneousValues: true },
      );
    });
  }

  async getForecast(userId: string, days = 30): Promise<ForecastResponseDto> {
    const today = await this.getUserDayStart(userId);
    // Cards due before today collapse into today's bucket, so we scan
    // from the epoch of the user's earliest due date up to today+days.
    const upperBound = SrsService.addDays(today, days);

    const grouped = await this.prisma.srsCard.groupBy({
      by: ['dueDate'],
      where: {
        userId,
        dueDate: { lt: upperBound },
      },
      _count: { _all: true },
    });

    // Bucket: date-string → count. Overdue cards fold into today.
    const counts = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      counts.set(SrsService.toDateString(SrsService.addDays(today, i)), 0);
    }
    const todayKey = SrsService.toDateString(today);

    for (const g of grouped) {
      const due = g.dueDate < today ? today : g.dueDate;
      const key = SrsService.toDateString(due);
      const bucket = due <= today ? todayKey : key;
      counts.set(bucket, (counts.get(bucket) ?? 0) + g._count._all);
    }

    const buckets: ForecastBucketDto[] = Array.from(counts.entries()).map(
      ([date, dueCount]) =>
        plainToInstance(
          ForecastBucketDto,
          { date, dueCount },
          { excludeExtraneousValues: true },
        ),
    );

    return plainToInstance(
      ForecastResponseDto,
      { days, buckets },
      { excludeExtraneousValues: true },
    );
  }

  private idempotencyKey(attemptId: string): string {
    return `srs:review:${attemptId}`;
  }

  private async readIdempotentResponse(
    attemptId: string,
  ): Promise<SrsReviewResponseDto | null> {
    const raw = await this.redis.get(this.idempotencyKey(attemptId));
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return plainToInstance(SrsReviewResponseDto, parsed, {
        excludeExtraneousValues: true,
      });
    } catch (err) {
      this.logger.warn(
        `Invalid SRS idempotency cache entry for attemptId=${attemptId}, ignoring: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async storeIdempotentResponse(
    attemptId: string,
    response: SrsReviewResponseDto,
  ): Promise<void> {
    await this.redis.set(
      this.idempotencyKey(attemptId),
      JSON.stringify(response),
      'EX',
      IDEMPOTENCY_TTL_SECONDS,
    );
  }
}
