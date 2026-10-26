import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MediaService } from 'src/common/media/media.service';
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
  const media = {
    resolveUrl: jest.fn((key: string | null) =>
      key ? `https://cdn/${key}` : null,
    ),
  };
  const svc = new CommentService(
    prisma as unknown as PrismaService,
    studySetService as unknown as StudySetService,
    media as unknown as MediaService,
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

// Section: visibility of deleted comments and author display

type FindManyArgs = { where: Record<string, unknown> };
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'c-1',
  content: 'hello',
  isDeleted: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  parentCommentId: null,
  user: {
    id: 'u-2',
    username: 'jane-doe',
    displayName: 'Jane Doe',
    profilePicture: 'avatars/u-2.webp',
    status: 'active',
  },
  _count: { replies: 0 },
  ...overrides,
});

describe('CommentService list filtering', () => {
  it('keeps deleted top-level comments only while they have live replies', async () => {
    const { svc, prisma } = build({ canAccess: true });

    await svc.listComments('u-1', 'set-1', {});

    const [args] = prisma.comment.findMany.mock.calls[0] as [FindManyArgs];
    expect(args.where).toMatchObject({
      studySetId: 'set-1',
      parentCommentId: null,
      OR: [{ isDeleted: false }, { replies: { some: { isDeleted: false } } }],
    });
  });

  it('hides deleted replies', async () => {
    const { svc, prisma } = build({ canAccess: true });

    await svc.listReplies('u-1', 'set-1', 'c-1', {});

    const [args] = prisma.comment.findMany.mock.calls[0] as [FindManyArgs];
    expect(args.where).toMatchObject({
      parentCommentId: 'c-1',
      isDeleted: false,
    });
  });
});

describe('CommentService author mapping', () => {
  it('shows the display name and a resolved avatar URL', async () => {
    const { svc, prisma } = build({ canAccess: true });
    prisma.$transaction.mockResolvedValue([[row()], 1]);

    const { data } = await svc.listComments('u-1', 'set-1', {});

    expect(data[0].author).toEqual({
      id: 'u-2',
      username: 'jane-doe',
      name: 'Jane Doe',
      profilePicture: 'https://cdn/avatars/u-2.webp',
    });
  });

  it('falls back to the username when there is no display name', async () => {
    const { svc, prisma } = build({ canAccess: true });
    prisma.$transaction.mockResolvedValue([
      [row({ user: { ...row().user, displayName: null } })],
      1,
    ]);

    const { data } = await svc.listComments('u-1', 'set-1', {});

    expect(data[0].author?.name).toBe('jane-doe');
  });

  it('labels comments from deleted accounts as "Deleted user"', async () => {
    const { svc, prisma } = build({ canAccess: true });
    prisma.$transaction.mockResolvedValue([
      [
        row({
          user: { ...row().user, username: 'deleted_ab12', status: 'deleted' },
        }),
      ],
      1,
    ]);

    const { data } = await svc.listComments('u-1', 'set-1', {});

    expect(data[0].author).toEqual({
      id: 'u-2',
      username: '',
      name: 'Deleted user',
      profilePicture: null,
    });
  });

  it('masks deleted comments and keeps the live reply count', async () => {
    const { svc, prisma } = build({ canAccess: true });
    prisma.$transaction.mockResolvedValue([
      [row({ isDeleted: true, content: 'secret', _count: { replies: 2 } })],
      1,
    ]);

    const { data } = await svc.listComments('u-1', 'set-1', {});

    expect(data[0]).toMatchObject({
      content: '[deleted]',
      author: null,
      replyCount: 2,
    });
  });
});
