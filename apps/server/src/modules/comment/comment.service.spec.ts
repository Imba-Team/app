import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';
import { CommentService } from './comment.service';

const build = ({ canAccess }: { canAccess: boolean }) => {
  const prisma = {
    studySet: {
      findUnique: jest.fn().mockResolvedValue({ id: 'set-1' }),
    },
    comment: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'c-1', studySetId: 'set-1' }),
      findMany: jest.fn().mockReturnValue('findMany'),
      count: jest.fn().mockReturnValue('count'),
    },
    $transaction: jest.fn().mockResolvedValue([[], 0]),
  };
  const studySetService = {
    canAccess: jest.fn().mockResolvedValue(canAccess),
  };
  const svc = new CommentService(
    prisma as unknown as PrismaService,
    studySetService as unknown as StudySetService,
  );
  return { svc, prisma, studySetService };
};

describe('CommentService.listComments', () => {
  it('rejects a user who cannot access the study set', async () => {
    const { svc, prisma, studySetService } = build({ canAccess: false });

    await expect(svc.listComments('u-1', 'set-1', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(studySetService.canAccess).toHaveBeenCalledWith('u-1', 'set-1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns comments when the user can access the set', async () => {
    const { svc } = build({ canAccess: true });

    const result = await svc.listComments('u-1', 'set-1', {});

    expect(result).toMatchObject({ data: [], total: 0 });
  });

  it('404s for a missing study set before checking access', async () => {
    const { svc, prisma, studySetService } = build({ canAccess: true });
    prisma.studySet.findUnique.mockResolvedValue(null);

    await expect(svc.listComments('u-1', 'nope', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(studySetService.canAccess).not.toHaveBeenCalled();
  });
});

describe('CommentService.listReplies', () => {
  it('rejects a user who cannot access the study set', async () => {
    const { svc, prisma } = build({ canAccess: false });

    await expect(
      svc.listReplies('u-1', 'set-1', 'c-1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns replies when the user can access the set', async () => {
    const { svc } = build({ canAccess: true });

    const result = await svc.listReplies('u-1', 'set-1', 'c-1', {});

    expect(result).toMatchObject({ data: [], total: 0 });
  });
});
