import { AnalyticsService } from './analytics.service';

const userId = '11111111-1111-1111-1111-111111111111';

const fakeLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }) as unknown as import('src/common/logger/logger.service').LoggerService;

const makeRedis = (cached: string | null = null) => ({
  get: jest.fn().mockResolvedValue(cached),
  set: jest.fn().mockResolvedValue('OK'),
});

/**
 * The service issues raw SQL for activity, study dates and retention (in
 * that call order inside Promise.all), so the mock routes $queryRaw by
 * the table names in the SQL text.
 */
const makePrisma = (opts: {
  timezone?: string;
  activity?: {
    day: string;
    answered: bigint;
    correct: bigint;
    seconds: bigint;
  }[];
  studyDates?: string[];
  retention?: { intervalBefore: number; rating: string; count: bigint }[];
  snapshots?: unknown[];
  live?: {
    count: number;
    newCount: number;
    learningCount: number;
    masteredCount: number;
  };
}) => ({
  user: {
    findUnique: jest
      .fn()
      .mockResolvedValue({ timezone: opts.timezone ?? 'UTC' }),
  },
  $queryRaw: jest.fn((strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('"intervalBefore", "rating"')) {
      return Promise.resolve(opts.retention ?? []);
    }
    if (sql.includes('UNION ALL')) return Promise.resolve(opts.activity ?? []);
    return Promise.resolve((opts.studyDates ?? []).map((day) => ({ day })));
  }),
  userSetProgressSnapshot: {
    groupBy: jest.fn().mockResolvedValue(opts.snapshots ?? []),
  },
  userSetProgress: {
    aggregate: jest.fn().mockResolvedValue({
      _count: { _all: opts.live?.count ?? 0 },
      _sum: {
        newCount: opts.live?.newCount ?? null,
        learningCount: opts.live?.learningCount ?? null,
        masteredCount: opts.live?.masteredCount ?? null,
      },
    }),
  },
});

describe('AnalyticsService.getProgress', () => {
  const now = new Date('2026-10-27T12:00:00Z');

  it('returns the cached payload without querying', async () => {
    const prisma = makePrisma({});
    const redis = makeRedis(
      JSON.stringify({ days: 30, timezone: 'UTC', currentStreak: 4 }),
    );
    const svc = new AnalyticsService(
      fakeLogger(),
      prisma as never,
      redis as never,
    );

    const result = await svc.getProgress(userId, 30, now);

    expect(result.currentStreak).toBe(4);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('zero-fills the range, sums totals and caches the result', async () => {
    const prisma = makePrisma({
      activity: [
        { day: '2026-10-26', answered: 10n, correct: 8n, seconds: 600n },
        { day: '2026-10-27', answered: 5n, correct: 5n, seconds: 90n },
        // Outside the 30-day window (the query reads one spare day).
        { day: '2026-09-27', answered: 99n, correct: 99n, seconds: 0n },
      ],
      studyDates: ['2026-10-25', '2026-10-26', '2026-10-27', '2026-09-27'],
    });
    const redis = makeRedis();
    const svc = new AnalyticsService(
      fakeLogger(),
      prisma as never,
      redis as never,
    );

    const result = await svc.getProgress(userId, 30, now);

    expect(result.activity).toHaveLength(30);
    expect(result.activity[0].date).toBe('2026-09-28');
    expect(result.activity[29]).toEqual({
      date: '2026-10-27',
      cardsAnswered: 5,
      correct: 5,
      minutes: 2,
    });
    expect(result.totals).toEqual({
      cardsAnswered: 15,
      correct: 13,
      minutes: 12,
      accuracy: 13 / 15,
    });
    expect(result.currentStreak).toBe(3);
    expect(result.studiedToday).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      `analytics:progress:${userId}:30`,
      expect.any(String),
      'EX',
      60,
    );
  });

  it('reports null accuracy and empty series for a new user', async () => {
    const svc = new AnalyticsService(
      fakeLogger(),
      makePrisma({}) as never,
      makeRedis() as never,
    );

    const result = await svc.getProgress(userId, 90, now);

    expect(result.activity).toHaveLength(90);
    expect(result.totals.accuracy).toBeNull();
    expect(result.currentStreak).toBe(0);
    expect(result.mastery).toEqual([]);
    expect(result.retention.every((b) => b.total === 0)).toBe(true);
  });

  it('uses the user timezone for "today" and appends a live mastery point', async () => {
    const prisma = makePrisma({
      timezone: 'Asia/Baku',
      snapshots: [
        {
          date: new Date('2026-10-27T00:00:00Z'),
          _sum: { newCount: 5, learningCount: 3, masteredCount: 2 },
        },
      ],
      live: { count: 2, newCount: 4, learningCount: 3, masteredCount: 3 },
    });
    const svc = new AnalyticsService(
      fakeLogger(),
      prisma as never,
      makeRedis() as never,
    );

    // 21:00 UTC is already Oct 28 in Baku.
    const result = await svc.getProgress(
      userId,
      30,
      new Date('2026-10-27T21:00:00Z'),
    );

    expect(result.timezone).toBe('Asia/Baku');
    expect(result.activity[29].date).toBe('2026-10-28');
    expect(result.mastery).toEqual([
      { date: '2026-10-27', newCount: 5, learningCount: 3, masteredCount: 2 },
      { date: '2026-10-28', newCount: 4, learningCount: 3, masteredCount: 3 },
    ]);
  });

  it('falls back to UTC for an unrecognised saved timezone', async () => {
    const svc = new AnalyticsService(
      fakeLogger(),
      makePrisma({ timezone: 'Mars/Olympus' }) as never,
      makeRedis() as never,
    );
    const result = await svc.getProgress(userId, 30, now);
    expect(result.timezone).toBe('UTC');
  });
});
