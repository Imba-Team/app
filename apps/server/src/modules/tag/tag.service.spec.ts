import { Prisma, StudySetVisibility } from '@prisma/client';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SearchSyncService } from 'src/modules/search/search-sync.service';

import { TagService } from './tag.service';

const noopLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as LoggerService;

const build = () => {
  const prisma = {
    tag: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
  };
  const svc = new TagService(
    noopLogger(),
    prisma as unknown as PrismaService,
    {} as SearchSyncService,
  );
  return { svc, prisma };
};

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('TagService.findOrCreateByName', () => {
  it('trims the name and reuses an existing tag matched by name or slug', async () => {
    const { svc, prisma } = build();
    const existing = { id: 't-1', name: 'Biology', slug: 'biology' };
    prisma.tag.findFirst.mockResolvedValue(existing);

    await expect(svc.findOrCreateByName('  biology ')).resolves.toBe(existing);
    expect(prisma.tag.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ slug: 'biology' }, { name: 'biology' }] },
    });
    expect(prisma.tag.create).not.toHaveBeenCalled();
  });

  it('creates the tag on first use', async () => {
    const { svc, prisma } = build();
    prisma.tag.findFirst.mockResolvedValue(null);
    prisma.tag.create.mockResolvedValue({ id: 't-2' });

    await svc.findOrCreateByName('Exam prep');

    expect(prisma.tag.create).toHaveBeenCalledWith({
      data: { name: 'Exam prep', slug: 'exam-prep' },
    });
  });

  it('re-reads instead of failing when a concurrent create wins the race', async () => {
    const { svc, prisma } = build();
    const winner = { id: 't-3', name: 'Chemistry', slug: 'chemistry' };
    prisma.tag.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    prisma.tag.create.mockRejectedValue(uniqueViolation());

    await expect(svc.findOrCreateByName('Chemistry')).resolves.toBe(winner);
  });

  it('rethrows other errors', async () => {
    const { svc, prisma } = build();
    prisma.tag.findFirst.mockResolvedValue(null);
    prisma.tag.create.mockRejectedValue(new Error('db down'));

    await expect(svc.findOrCreateByName('Physics')).rejects.toThrow('db down');
  });
});

describe('TagService.findOrCreateMany', () => {
  it('de-duplicates names that slugify alike, keeping the first spelling', async () => {
    const { svc } = build();
    const spy = jest
      .spyOn(svc, 'findOrCreateByName')
      .mockImplementation((name) =>
        Promise.resolve({ id: name, name, slug: name, createdAt: new Date() }),
      );

    const tags = await svc.findOrCreateMany([
      'Biology',
      ' biology ',
      'Exam Prep',
      'exam-prep',
    ]);

    expect(spy.mock.calls.map((c) => c[0])).toEqual(['Biology', 'Exam Prep']);
    expect(tags).toHaveLength(2);
  });
});

describe('TagService.replaceStudySetTags', () => {
  it('removes tags not in the list and adds the new ones', async () => {
    const { svc } = build();
    const tx = {
      studySetTag: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    await svc.replaceStudySetTags(
      tx as unknown as Prisma.TransactionClient,
      's-1',
      ['t-1', 't-2'],
    );

    expect(tx.studySetTag.deleteMany).toHaveBeenCalledWith({
      where: { studySetId: 's-1', tagId: { notIn: ['t-1', 't-2'] } },
    });
    expect(tx.studySetTag.createMany).toHaveBeenCalledWith({
      data: [
        { studySetId: 's-1', tagId: 't-1' },
        { studySetId: 's-1', tagId: 't-2' },
      ],
      skipDuplicates: true,
    });
  });

  it('clears every tag for an empty list', async () => {
    const { svc } = build();
    const tx = {
      studySetTag: { deleteMany: jest.fn(), createMany: jest.fn() },
    };

    await svc.replaceStudySetTags(
      tx as unknown as Prisma.TransactionClient,
      's-1',
      [],
    );

    expect(tx.studySetTag.deleteMany).toHaveBeenCalledWith({
      where: { studySetId: 's-1', tagId: { notIn: [] } },
    });
    expect(tx.studySetTag.createMany).not.toHaveBeenCalled();
  });
});

describe('TagService.suggest (MIM-37)', () => {
  type FindManyArgs = {
    where: { AND: unknown[] };
    orderBy: unknown;
    take: number;
  };
  const lastArgs = (prisma: ReturnType<typeof build>['prisma']) =>
    (prisma.tag.findMany.mock.calls[0] as [FindManyArgs])[0];

  it('only suggests tags on public sets or the caller’s own sets, most-used first', async () => {
    const { svc, prisma } = build();

    await svc.suggest('u-1', undefined, 8);

    const args = lastArgs(prisma);
    expect(args.where.AND[0]).toEqual({
      studySetTag: {
        some: {
          studySet: {
            OR: [{ visibility: StudySetVisibility.PUBLIC }, { ownerId: 'u-1' }],
          },
        },
      },
    });
    expect(args.where.AND[1]).toEqual({});
    expect(args.orderBy).toEqual([
      { studySetTag: { _count: 'desc' } },
      { name: 'asc' },
    ]);
    expect(args.take).toBe(8);
  });

  it('matches the query against name (case-insensitive) and slug', async () => {
    const { svc, prisma } = build();

    await svc.suggest('u-1', '  Exam Prep ', 5);

    expect(lastArgs(prisma).where.AND[1]).toEqual({
      OR: [
        { name: { contains: 'Exam Prep', mode: 'insensitive' } },
        { slug: { contains: 'exam-prep' } },
      ],
    });
  });
});
