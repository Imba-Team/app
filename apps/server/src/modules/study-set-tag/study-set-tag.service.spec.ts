import { ForbiddenException } from '@nestjs/common';
import { Role } from 'src/common/decorators/roles.decorator';
import { IUser } from 'src/common/interfaces/user.interface';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SearchSyncService } from 'src/modules/search/search-sync.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';
import { TagService } from 'src/modules/tag/tag.service';

import { StudySetTagService } from './study-set-tag.service';

const noopLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as LoggerService;

const user = (id: string, role = Role.USER) =>
  ({ id, role }) as unknown as IUser;

const build = (canEdit: boolean) => {
  const prisma = {
    studySet: {
      findUnique: jest.fn().mockResolvedValue({ id: 's-1', ownerId: 'owner' }),
    },
    studySetTag: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'link' }),
    },
  };
  const studySets = { canEdit: jest.fn().mockResolvedValue(canEdit) };
  const tags = {
    findOrCreateByName: jest
      .fn()
      .mockResolvedValue({ id: 't-1', name: 'Biology', slug: 'biology' }),
  };
  const svc = new StudySetTagService(
    noopLogger(),
    prisma as unknown as PrismaService,
    studySets as unknown as StudySetService,
    { enqueueSync: jest.fn() } as unknown as SearchSyncService,
    tags as unknown as TagService,
  );
  return { svc, prisma, tags };
};

describe('StudySetTagService.addTagToStudySet permissions (MIM-44)', () => {
  const dto = { studySetId: 's-1', tagName: 'Biology' };

  it('lets an EDITOR collaborator attach a tag', async () => {
    const { svc, prisma } = build(true);

    await svc.addTagToStudySet(user('editor'), dto);

    expect(prisma.studySetTag.create).toHaveBeenCalledWith({
      data: { studySetId: 's-1', tagId: 't-1' },
    });
  });

  it('rejects other users without creating the tag first', async () => {
    const { svc, tags, prisma } = build(false);

    await expect(svc.addTagToStudySet(user('stranger'), dto)).rejects.toThrow(
      ForbiddenException,
    );
    expect(tags.findOrCreateByName).not.toHaveBeenCalled();
    expect(prisma.studySetTag.create).not.toHaveBeenCalled();
  });

  it('lets an admin moderate any set', async () => {
    const { svc, prisma } = build(false);

    await svc.addTagToStudySet(user('admin', Role.ADMIN), dto);

    expect(prisma.studySetTag.create).toHaveBeenCalled();
  });
});
