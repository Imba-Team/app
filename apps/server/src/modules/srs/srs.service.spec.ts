import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { SrsService } from './srs.service';

interface PrismaMock {
  srsCard: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    groupBy: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
}

const makePrisma = (): PrismaMock => {
  const mock: PrismaMock = {
    srsCard: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    user: {
      // Default: unknown user → SrsService falls back to UTC. Tests
      // that care about a specific timezone override this per-case.
      findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
    },
    $transaction: jest.fn(),
  };
  // $transaction supports both array-of-promises and callback forms
  mock.$transaction.mockImplementation(
    (arg: ((tx: PrismaMock) => unknown) | Promise<unknown>[]) => {
      if (typeof arg === 'function') return Promise.resolve(arg(mock));
      return Promise.all(arg);
    },
  );
  return mock;
};

const makeRedis = () =>
  ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  }) as unknown as import('ioredis').Redis;

const fakeLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
  }) as unknown as import('src/common/logger/logger.service').LoggerService;

const startOfUtcDay = (d: Date = new Date()): Date => {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c;
};

const addDays = (d: Date, n: number): Date => {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
};

describe('SrsService', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const srsCardId = '22222222-2222-2222-2222-222222222222';
  const cardId = '33333333-3333-3333-3333-333333333333';
  const studySetId = '44444444-4444-4444-4444-444444444444';

  describe('review', () => {
    it('advances dueDate by SM-2 interval on GOOD rating from a fresh card', async () => {
      const prisma = makePrisma();
      const redis = makeRedis();

      prisma.srsCard.findUnique.mockResolvedValue({
        id: srsCardId,
        userId,
        cardId,
        easeFactor: new Prisma.Decimal('2.50'),
        intervalDays: 0,
        repetitions: 0,
        lapses: 0,
        isLeech: false,
        dueDate: startOfUtcDay(),
        lastReviewed: null,
        card: {
          id: cardId,
          studySetId,
          term: 'Hola',
          definition: 'Hello',
          hint: null,
        },
      });

      prisma.srsCard.update.mockImplementation(
        ({ data }: { data: Prisma.SrsCardUpdateInput }) =>
          Promise.resolve({
            id: srsCardId,
            userId,
            cardId,
            easeFactor: data.easeFactor,
            intervalDays: data.intervalDays,
            repetitions: data.repetitions,
            lapses: data.lapses,
            isLeech: data.isLeech,
            dueDate: data.dueDate,
            lastReviewed: data.lastReviewed,
          }),
      );
      prisma.srsCard.count.mockResolvedValue(0);

      const svc = new SrsService(fakeLogger(), prisma as never, redis);

      const result = await svc.review(userId, srsCardId, {
        attemptId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        rating: 'GOOD',
      });

      // Fresh card + GOOD → interval 1 day, repetitions 1.
      expect(result.card.intervalDays).toBe(1);
      expect(result.card.repetitions).toBe(1);
      expect(result.card.dueDate).toBe(
        addDays(startOfUtcDay(), 1).toISOString().slice(0, 10),
      );
      expect(result.remainingDueToday).toBe(0);
    });

    it('AGAIN increments lapses and resets interval to 1 day', async () => {
      const prisma = makePrisma();
      const redis = makeRedis();

      prisma.srsCard.findUnique.mockResolvedValue({
        id: srsCardId,
        userId,
        cardId,
        easeFactor: new Prisma.Decimal('2.30'),
        intervalDays: 10,
        repetitions: 3,
        lapses: 1,
        isLeech: false,
        dueDate: startOfUtcDay(),
        lastReviewed: null,
        card: {
          id: cardId,
          studySetId,
          term: 't',
          definition: 'd',
          hint: null,
        },
      });
      prisma.srsCard.update.mockImplementation(
        ({ data }: { data: Prisma.SrsCardUpdateInput }) =>
          Promise.resolve({
            id: srsCardId,
            userId,
            cardId,
            easeFactor: data.easeFactor,
            intervalDays: data.intervalDays,
            repetitions: data.repetitions,
            lapses: data.lapses,
            isLeech: data.isLeech,
            dueDate: data.dueDate,
            lastReviewed: data.lastReviewed,
          }),
      );
      prisma.srsCard.count.mockResolvedValue(0);

      const svc = new SrsService(fakeLogger(), prisma as never, redis);

      const result = await svc.review(userId, srsCardId, {
        attemptId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        rating: 'AGAIN',
      });

      expect(result.card.intervalDays).toBe(1);
      expect(result.card.repetitions).toBe(0);
      expect(result.card.lapses).toBe(2);
    });

    it("rejects reviewing another user's card", async () => {
      const prisma = makePrisma();
      prisma.srsCard.findUnique.mockResolvedValue({
        id: srsCardId,
        userId: 'someone-else',
        cardId,
        easeFactor: new Prisma.Decimal('2.50'),
        intervalDays: 0,
        repetitions: 0,
        lapses: 0,
        isLeech: false,
        dueDate: startOfUtcDay(),
        lastReviewed: null,
        card: {
          id: cardId,
          studySetId,
          term: 't',
          definition: 'd',
          hint: null,
        },
      });

      const svc = new SrsService(fakeLogger(), prisma as never, makeRedis());

      await expect(
        svc.review(userId, srsCardId, {
          attemptId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          rating: 'GOOD',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404s when SRS card is missing', async () => {
      const prisma = makePrisma();
      prisma.srsCard.findUnique.mockResolvedValue(null);

      const svc = new SrsService(fakeLogger(), prisma as never, makeRedis());

      await expect(
        svc.review(userId, srsCardId, {
          attemptId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          rating: 'GOOD',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('short-circuits on cached idempotent response', async () => {
      const prisma = makePrisma();
      const redis = {
        get: jest.fn().mockResolvedValue(
          JSON.stringify({
            card: {
              id: srsCardId,
              cardId,
              studySetId,
              term: 't',
              definition: 'd',
              hint: null,
              easeFactor: '2.50',
              intervalDays: 1,
              repetitions: 1,
              lapses: 0,
              dueDate: '2026-07-24',
              lastReviewed: null,
              isLeech: false,
            },
            remainingDueToday: 4,
          }),
        ),
        set: jest.fn(),
      } as unknown as import('ioredis').Redis;

      const svc = new SrsService(fakeLogger(), prisma as never, redis);

      const result = await svc.review(userId, srsCardId, {
        attemptId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        rating: 'GOOD',
      });

      expect(result.remainingDueToday).toBe(4);
      expect(prisma.srsCard.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getForecast', () => {
    it('produces one bucket per day and folds overdue into today', async () => {
      const prisma = makePrisma();
      const today = startOfUtcDay();

      prisma.srsCard.groupBy.mockResolvedValue([
        // Overdue by 3 days — should fold into today's bucket
        { dueDate: addDays(today, -3), _count: { _all: 2 } },
        // Today
        { dueDate: today, _count: { _all: 1 } },
        // Day 2
        { dueDate: addDays(today, 2), _count: { _all: 5 } },
      ]);

      const svc = new SrsService(fakeLogger(), prisma as never, makeRedis());

      const forecast = await svc.getForecast(userId, 7);
      expect(forecast.days).toBe(7);
      expect(forecast.buckets).toHaveLength(7);

      const todayKey = today.toISOString().slice(0, 10);
      const day2Key = addDays(today, 2).toISOString().slice(0, 10);

      const today_ = forecast.buckets.find((b) => b.date === todayKey);
      const day2_ = forecast.buckets.find((b) => b.date === day2Key);

      expect(today_?.dueCount).toBe(3); // 2 overdue + 1 today
      expect(day2_?.dueCount).toBe(5);
    });
  });

  describe('getTodayQueue', () => {
    it('returns cards due today or earlier, ordered by dueDate', async () => {
      const prisma = makePrisma();
      const today = startOfUtcDay();

      prisma.srsCard.findMany.mockResolvedValue([
        {
          id: srsCardId,
          cardId,
          easeFactor: new Prisma.Decimal('2.50'),
          intervalDays: 0,
          repetitions: 0,
          lapses: 0,
          dueDate: today,
          lastReviewed: null,
          isLeech: false,
          card: {
            id: cardId,
            studySetId,
            term: 'Hola',
            definition: 'Hello',
            hint: null,
          },
        },
      ]);
      prisma.srsCard.count.mockResolvedValue(1);

      const svc = new SrsService(fakeLogger(), prisma as never, makeRedis());

      const { items, total } = await svc.getTodayQueue(userId, 50, 0);
      expect(total).toBe(1);
      expect(items).toHaveLength(1);
      expect(items[0].cardId).toBe(cardId);
      expect(items[0].term).toBe('Hola');
    });
  });
});
