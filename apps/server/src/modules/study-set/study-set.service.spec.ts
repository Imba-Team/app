import { ForbiddenException } from '@nestjs/common';
import { CollaboratorRole, Prisma, StudySetVisibility } from '@prisma/client';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SearchSyncService } from 'src/modules/search/search-sync.service';
import { TagService } from 'src/modules/tag/tag.service';
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
    {} as TagService,
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
    {} as TagService,
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
    {} as TagService,
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

describe('StudySetService.update (MIM-44)', () => {
  type Role = CollaboratorRole | null;
  const buildForUpdate = (collaboratorRole: Role = null) => {
    const set = {
      id: 'set-1',
      slug: 'biology',
      title: 'Biology',
      description: null,
      language: 'German',
      ownerId: 'owner',
      visibility: StudySetVisibility.PUBLIC,
      viewCount: 7,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      flashcards: [],
    };
    const tx = { studySet: { update: jest.fn().mockResolvedValue(set) } };
    const prisma = {
      studySet: { findUnique: jest.fn().mockResolvedValue(set) },
      studySetCollaborator: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            collaboratorRole ? { role: collaboratorRole } : null,
          ),
      },
      favouriteStudySet: { findUnique: jest.fn().mockResolvedValue(null) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'owner',
          username: 'owner',
          profilePicture: null,
        }),
      },
      studySetTag: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { tag: { id: 't-2', name: 'Zoology', slug: 'zoology' } },
            { tag: { id: 't-1', name: 'Biology', slug: 'biology' } },
          ]),
      },
      $transaction: jest
        .fn()
        .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const searchSync = { enqueueSync: jest.fn().mockResolvedValue(undefined) };
    const tagService = {
      findOrCreateMany: jest
        .fn()
        .mockImplementation((names: string[]) =>
          Promise.resolve(names.map((n) => ({ id: `id-${n}`, name: n }))),
        ),
      replaceStudySetTags: jest.fn().mockResolvedValue(undefined),
    };
    const svc = new StudySetService(
      noopLogger(),
      prisma as unknown as PrismaService,
      {} as UsersService,
      searchSync as unknown as SearchSyncService,
      tagService as unknown as TagService,
    );
    return { svc, prisma, tx, searchSync, tagService };
  };
  type UpdateArgs = { data: Record<string, unknown> };
  const updatedData = (tx: { studySet: { update: jest.Mock } }) =>
    (tx.studySet.update.mock.calls[0] as [UpdateArgs])[0].data;

  it('lets the owner update every field, with tags replaced in the same transaction', async () => {
    const { svc, tx, searchSync, tagService } = buildForUpdate();

    await svc.update('owner', 'set-1', {
      title: 'Biology 101',
      description: 'Cells',
      language: '  Spanish ',
      isPrivate: true,
      tags: ['cells', 'exam'],
    });

    expect(updatedData(tx)).toEqual({
      title: 'Biology 101',
      description: 'Cells',
      language: 'Spanish',
      visibility: StudySetVisibility.PRIVATE,
    });
    expect(tagService.findOrCreateMany).toHaveBeenCalledWith(['cells', 'exam']);
    expect(tagService.replaceStudySetTags).toHaveBeenCalledWith(tx, 'set-1', [
      'id-cells',
      'id-exam',
    ]);
    expect(searchSync.enqueueSync).toHaveBeenCalledTimes(1);
  });

  it.each([[''], ['   '], [null]])(
    'clears the language for %j',
    async (language) => {
      const { svc, tx } = buildForUpdate();
      await svc.update('owner', 'set-1', { language });
      expect(updatedData(tx)).toEqual({ language: null });
    },
  );

  it('leaves tags alone when the field is omitted, and clears them for []', async () => {
    const omitted = buildForUpdate();
    await omitted.svc.update('owner', 'set-1', { title: 'New' });
    expect(omitted.tagService.replaceStudySetTags).not.toHaveBeenCalled();

    const cleared = buildForUpdate();
    await cleared.svc.update('owner', 'set-1', { tags: [] });
    expect(cleared.tx.studySet.update).not.toHaveBeenCalled();
    expect(cleared.tagService.replaceStudySetTags).toHaveBeenCalledWith(
      cleared.tx,
      'set-1',
      [],
    );
    expect(cleared.searchSync.enqueueSync).toHaveBeenCalledTimes(1);
  });

  it('lets an EDITOR change details and tags', async () => {
    const { svc, tx, tagService } = buildForUpdate(CollaboratorRole.EDITOR);

    const result = await svc.update('editor', 'set-1', {
      title: 'Edited',
      tags: ['cells'],
    });

    expect(updatedData(tx)).toEqual({ title: 'Edited' });
    expect(tagService.replaceStudySetTags).toHaveBeenCalled();
    expect(result).toMatchObject({ isOwner: false, canEdit: true });
  });

  it('keeps visibility owner-only, even for an EDITOR', async () => {
    const { svc, prisma } = buildForUpdate(CollaboratorRole.EDITOR);

    await expect(
      svc.update('editor', 'set-1', { isPrivate: true }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['a VIEWER', CollaboratorRole.VIEWER],
    ['a stranger', null],
  ])('rejects %s', async (_label, role) => {
    const { svc, prisma, tagService } = buildForUpdate(role);

    await expect(
      svc.update('someone', 'set-1', { title: 'Hijack', tags: ['x1'] }),
    ).rejects.toThrow(ForbiddenException);
    expect(tagService.findOrCreateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns language, name-sorted tags, canEdit and viewCount', async () => {
    const { svc } = buildForUpdate();

    const result = await svc.update('owner', 'set-1', {});

    expect(result).toMatchObject({
      language: 'German',
      tags: [
        { id: 't-1', name: 'Biology', slug: 'biology' },
        { id: 't-2', name: 'Zoology', slug: 'zoology' },
      ],
      isOwner: true,
      canEdit: true,
      viewCount: 7,
    });
  });
});

describe('StudySetService.create with tags and language (MIM-44)', () => {
  it('normalises the language and attaches the tags', async () => {
    const tx = {};
    const prisma = {
      studySet: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: object }) =>
            Promise.resolve({ id: 'new-set', ...data }),
          ),
      },
      $transaction: jest
        .fn()
        .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const tagService = {
      findOrCreateMany: jest.fn().mockResolvedValue([{ id: 't-1' }]),
      replaceStudySetTags: jest.fn().mockResolvedValue(undefined),
    };
    const svc = new StudySetService(
      noopLogger(),
      prisma as unknown as PrismaService,
      {
        findById: jest.fn().mockResolvedValue({ id: 'u-1' }),
      } as unknown as UsersService,
      { enqueueSync: jest.fn() } as unknown as SearchSyncService,
      tagService as unknown as TagService,
    );
    jest
      .spyOn(
        svc as unknown as { buildStudySetForUser: () => Promise<unknown> },
        'buildStudySetForUser',
      )
      .mockResolvedValue({ id: 'new-set' });

    await svc.create('u-1', {
      title: 'Spanish',
      language: ' Spanish ',
      tags: ['languages'],
    });

    const [{ data }] = prisma.studySet.create.mock.calls[0] as [
      { data: { language: string | null } },
    ];
    expect(data.language).toBe('Spanish');
    expect(tagService.replaceStudySetTags).toHaveBeenCalledWith(tx, 'new-set', [
      't-1',
    ]);
  });
});
