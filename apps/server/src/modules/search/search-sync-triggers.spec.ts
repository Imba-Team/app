/**
 * MIM-45: every write that changes a field in a set's search document
 * (cardCount, likeCount, tags) must enqueue a sync for that set.
 */
import { StudySetVisibility } from '@prisma/client';
import { IUser } from 'src/common/interfaces/user.interface';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { FavouriteStudySetService } from 'src/modules/favourite-study-set/favourite-study-set.service';
import { FlashcardService } from 'src/modules/flashcard/flashcard.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';
import { StudySetTagService } from 'src/modules/study-set-tag/study-set-tag.service';
import { TagService } from 'src/modules/tag/tag.service';

import { SearchSyncService } from './search-sync.service';

const noopLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as LoggerService;

const makeSearchSync = () => ({
  enqueueSync: jest.fn().mockResolvedValue(undefined),
  enqueueSyncMany: jest.fn().mockResolvedValue(undefined),
});

const card = {
  id: 'c-1',
  studySetId: 's-1',
  term: 't',
  definition: 'd',
  alternateAnswers: [],
  example: null,
  phonetic: null,
  hint: null,
  imageUrl: null,
  orderIndex: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('FlashcardService search sync', () => {
  const build = () => {
    const prisma = {
      flashcard: {
        create: jest.fn().mockResolvedValue(card),
        delete: jest.fn().mockResolvedValue(card),
        findUnique: jest.fn().mockResolvedValue(card),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const studySets = { canEdit: jest.fn().mockResolvedValue(true) };
    const searchSync = makeSearchSync();
    const svc = new FlashcardService(
      noopLogger(),
      prisma as unknown as PrismaService,
      studySets as unknown as StudySetService,
      searchSync as unknown as SearchSyncService,
    );
    return { svc, searchSync };
  };

  it('syncs the set after a card is created', async () => {
    const { svc, searchSync } = build();
    await svc.create('u-1', 's-1', { term: 't', definition: 'd' });
    expect(searchSync.enqueueSync).toHaveBeenCalledWith('s-1');
  });

  it('syncs the set after a card is deleted', async () => {
    const { svc, searchSync } = build();
    await svc.delete('u-1', 'c-1');
    expect(searchSync.enqueueSync).toHaveBeenCalledWith('s-1');
  });
});

describe('FavouriteStudySetService search sync', () => {
  const build = (removed = 1) => {
    const prisma = {
      favouriteStudySet: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: removed }),
      },
    };
    const studySets = {
      findByIdOrFail: jest.fn().mockResolvedValue({
        id: 's-1',
        ownerId: 'owner',
        visibility: StudySetVisibility.PUBLIC,
      }),
      getById: jest.fn().mockResolvedValue({ id: 's-1' }),
    };
    const searchSync = makeSearchSync();
    const svc = new FavouriteStudySetService(
      noopLogger(),
      studySets as unknown as StudySetService,
      prisma as unknown as PrismaService,
      searchSync as unknown as SearchSyncService,
    );
    return { svc, searchSync };
  };

  it('syncs the set after it is saved', async () => {
    const { svc, searchSync } = build();
    await svc.addToLibrary('u-2', 's-1');
    expect(searchSync.enqueueSync).toHaveBeenCalledWith('s-1');
  });

  it('syncs the set after it is unsaved', async () => {
    const { svc, searchSync } = build(1);
    await svc.removeFromLibrary('u-2', 's-1');
    expect(searchSync.enqueueSync).toHaveBeenCalledWith('s-1');
  });

  it('skips the sync when nothing was unsaved', async () => {
    const { svc, searchSync } = build(0);
    await svc.removeFromLibrary('u-2', 's-1');
    expect(searchSync.enqueueSync).not.toHaveBeenCalled();
  });
});

describe('StudySetTagService search sync', () => {
  const owner = { id: 'owner', role: 'user' } as unknown as IUser;
  const build = () => {
    const tag = { id: 't-1', name: 'Biology', slug: 'biology' };
    const prisma = {
      studySet: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 's-1', ownerId: 'owner' }),
      },
      tag: {
        findUnique: jest.fn().mockResolvedValue(tag),
        findFirst: jest.fn().mockResolvedValue(tag),
        upsert: jest.fn().mockResolvedValue(tag),
        create: jest.fn().mockResolvedValue(tag),
      },
      studySetTag: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValue({
            studySetId: 's-1',
            tagId: 't-1',
            studySet: { ownerId: 'owner' },
          }),
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const searchSync = makeSearchSync();
    const svc = new StudySetTagService(
      noopLogger(),
      prisma as unknown as PrismaService,
      {} as StudySetService,
      searchSync as unknown as SearchSyncService,
      {
        findOrCreateByName: jest.fn().mockResolvedValue(tag),
      } as unknown as TagService,
    );
    return { svc, searchSync };
  };

  it('syncs the set after a tag is attached and after it is detached', async () => {
    const { svc, searchSync } = build();

    await svc.addTagToStudySet(owner, {
      studySetId: 's-1',
      tagName: 'Biology',
    });
    expect(searchSync.enqueueSync).toHaveBeenLastCalledWith('s-1');

    await svc.removeTagFromStudySet(owner, 's-1', 't-1');
    expect(searchSync.enqueueSync).toHaveBeenCalledTimes(2);
  });
});

describe('TagService rename search sync', () => {
  it('syncs every set carrying the renamed tag', async () => {
    const prisma = {
      tag: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 't-1', name: 'Bio', slug: 'bio' }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest
          .fn()
          .mockResolvedValue({ id: 't-1', name: 'Biology', slug: 'biology' }),
      },
      studySetTag: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ studySetId: 's-1' }, { studySetId: 's-2' }]),
      },
    };
    const searchSync = makeSearchSync();
    const svc = new TagService(
      noopLogger(),
      prisma as unknown as PrismaService,
      searchSync as unknown as SearchSyncService,
    );

    await svc.update('t-1', { name: 'Biology' });

    expect(prisma.studySetTag.findMany).toHaveBeenCalledWith({
      where: { tagId: 't-1' },
      select: { studySetId: true },
    });
    expect(searchSync.enqueueSyncMany).toHaveBeenCalledWith(['s-1', 's-2']);
  });
});
