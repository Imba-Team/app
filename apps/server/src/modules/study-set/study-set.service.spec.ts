import { CollaboratorRole, Prisma, StudySetVisibility } from '@prisma/client';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SearchSyncService } from 'src/modules/search/search-sync.service';
import { UsersService } from 'src/modules/users/user.service';
import { PublicSetSort } from './dtos/search-study-sets.dto';
import { StudySetService } from './study-set.service';

const noopLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
  }) as unknown as LoggerService;

const build = () => {
  const prisma = { studySet: { findMany: jest.fn().mockResolvedValue([]) } };
  const svc = new StudySetService(
    noopLogger(),
    prisma as unknown as PrismaService,
    {} as UsersService,
    {} as SearchSyncService,
  );
  // Per-user decoration (favourites, progress) is out of scope here.
  jest
    .spyOn(
      svc as unknown as {
        buildStudySetsForUserBatch: () => Promise<unknown[]>;
      },
      'buildStudySetsForUserBatch',
    )
    .mockResolvedValue([]);
  return { svc, prisma };
};

type FindManyArgs = { where: { ownerId?: unknown; OR?: unknown[] } };
const lastWhere = (prisma: { studySet: { findMany: jest.Mock } }) =>
  (prisma.studySet.findMany.mock.calls[0] as [FindManyArgs])[0].where;

describe('StudySetService.searchPublic', () => {
  it("excludes the caller's own sets from public results", async () => {
    const { svc, prisma } = build();

    await svc.searchPublic('u-1', { sort: PublicSetSort.POPULAR });

    const where = lastWhere(prisma);
    expect(where).toMatchObject({
      visibility: StudySetVisibility.PUBLIC,
      ownerId: { not: 'u-1' },
    });
  });

  it('keeps the text filter alongside the exclusion', async () => {
    const { svc, prisma } = build();

    await svc.searchPublic('u-1', { q: 'kanji' });

    const where = lastWhere(prisma);
    expect(where.ownerId).toEqual({ not: 'u-1' });
    expect(where.OR).toHaveLength(2);
  });
});

// Section: create — titles may repeat, slugs stay unique

const buildForCreate = (takenSlugs: string[]) => {
  const prisma = {
    studySet: {
      findMany: jest
        .fn()
        .mockResolvedValue(takenSlugs.map((slug) => ({ slug }))),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: { slug: string } }) =>
          Promise.resolve({ id: 'new-set', ...data }),
        ),
    },
  };
  const usersService = { findById: jest.fn().mockResolvedValue({ id: 'u-2' }) };
  const searchSync = { enqueueSync: jest.fn().mockResolvedValue(undefined) };
  const svc = new StudySetService(
    noopLogger(),
    prisma as unknown as PrismaService,
    usersService as unknown as UsersService,
    searchSync as unknown as SearchSyncService,
  );
  jest
    .spyOn(
      svc as unknown as { buildStudySetForUser: () => Promise<unknown> },
      'buildStudySetForUser',
    )
    .mockResolvedValue({ id: 'new-set' });
  return { svc, prisma };
};

type CreateArgs = { data: { slug: string; title: string; ownerId: string } };
const createdData = (prisma: { studySet: { create: jest.Mock } }, call = 0) =>
  (prisma.studySet.create.mock.calls[call] as [CreateArgs])[0].data;

describe('StudySetService.create', () => {
  it('uses the plain slug when nobody has the title yet', async () => {
    const { svc, prisma } = buildForCreate([]);

    await svc.create('u-2', { title: 'Biology' });

    expect(createdData(prisma)).toMatchObject({
      slug: 'biology',
      title: 'Biology',
      ownerId: 'u-2',
    });
  });

  it("lets a second user reuse another user's title with a suffixed slug", async () => {
    const { svc, prisma } = buildForCreate(['biology']);

    await expect(svc.create('u-2', { title: 'Biology' })).resolves.toEqual({
      id: 'new-set',
    });

    expect(createdData(prisma)).toMatchObject({
      slug: 'biology-2',
      title: 'Biology',
    });
  });

  it('skips every taken suffix', async () => {
    const { svc, prisma } = buildForCreate(['biology', 'biology-2']);

    await svc.create('u-2', { title: 'Biology' });

    expect(createdData(prisma).slug).toBe('biology-3');
  });

  it('retries when a concurrent create grabs the same slug first', async () => {
    const { svc, prisma } = buildForCreate([]);
    prisma.studySet.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ slug: 'biology' }]);
    prisma.studySet.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await svc.create('u-2', { title: 'Biology' });

    expect(prisma.studySet.create).toHaveBeenCalledTimes(2);
    expect(createdData(prisma, 1).slug).toBe('biology-2');
  });

  it('does not swallow unrelated database errors', async () => {
    const { svc, prisma } = buildForCreate([]);
    prisma.studySet.create.mockRejectedValueOnce(new Error('connection lost'));

    await expect(svc.create('u-2', { title: 'Biology' })).rejects.toThrow(
      'connection lost',
    );
    expect(prisma.studySet.create).toHaveBeenCalledTimes(1);
  });
});

// Section: canEdit — collaborator role decides, not visibility

const buildForCanEdit = (
  visibility: StudySetVisibility,
  role: CollaboratorRole | null,
) => {
  const prisma = {
    studySet: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'set-1', ownerId: 'owner', visibility }),
    },
    studySetCollaborator: {
      findUnique: jest.fn().mockResolvedValue(role ? { role } : null),
    },
  };
  const svc = new StudySetService(
    noopLogger(),
    prisma as unknown as PrismaService,
    {} as UsersService,
    {} as SearchSyncService,
  );
  return { svc };
};

describe('StudySetService.canEdit', () => {
  it.each([
    StudySetVisibility.PUBLIC,
    StudySetVisibility.UNLISTED,
    StudySetVisibility.PRIVATE,
  ])('lets an EDITOR edit a %s set', async (visibility) => {
    const { svc } = buildForCanEdit(visibility, CollaboratorRole.EDITOR);

    await expect(svc.canEdit('editor', 'set-1')).resolves.toBe(true);
  });

  it('does not let a VIEWER edit', async () => {
    const { svc } = buildForCanEdit(
      StudySetVisibility.PUBLIC,
      CollaboratorRole.VIEWER,
    );

    await expect(svc.canEdit('viewer', 'set-1')).resolves.toBe(false);
  });

  it('does not let a non-collaborator edit a public set', async () => {
    const { svc } = buildForCanEdit(StudySetVisibility.PUBLIC, null);

    await expect(svc.canEdit('stranger', 'set-1')).resolves.toBe(false);
  });

  it('always lets the owner edit', async () => {
    const { svc } = buildForCanEdit(StudySetVisibility.PUBLIC, null);

    await expect(svc.canEdit('owner', 'set-1')).resolves.toBe(true);
  });
});
