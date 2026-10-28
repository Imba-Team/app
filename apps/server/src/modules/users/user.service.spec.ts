import { NotFoundException } from '@nestjs/common';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { Queue } from 'bullmq';
import { SearchSyncJobPayload } from 'src/common/queue/queue.constants';
import { UsersService } from './user.service';

const noopLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
  }) as unknown as LoggerService;

interface PrismaMock {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
}

const makePrisma = (): PrismaMock => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
});

const build = (prismaOverride?: PrismaMock) => {
  const prisma = prismaOverride ?? makePrisma();
  const svc = new UsersService(
    noopLogger(),
    prisma as unknown as PrismaService,
    { add: jest.fn() } as unknown as Queue<SearchSyncJobPayload>,
  );
  return { svc, prisma };
};

describe('UsersService.findByUsername', () => {
  it('returns the row when found', async () => {
    const { svc, prisma } = build();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1',
      username: 'jane',
    });

    const result = await svc.findByUsername('jane');
    expect(result?.id).toBe('u-1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'jane' },
    });
  });

  it('returns null when not found', async () => {
    const { svc, prisma } = build();
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await svc.findByUsername('ghost');
    expect(result).toBeNull();
  });
});

describe('UsersService.updateMyProfile', () => {
  const existing = {
    id: 'u-1',
    username: 'jane',
    email: 'j@x.y',
    bio: null,
    role: 'user',
    status: 'active',
  };

  it('writes name to displayName and never renames the username', async () => {
    const { svc, prisma } = build();
    prisma.user.findUnique.mockResolvedValue(existing);
    prisma.user.update.mockResolvedValue({
      ...existing,
      displayName: 'Jane Doe',
    });

    await svc.updateMyProfile('u-1', { name: '  Jane Doe ' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { displayName: 'Jane Doe' },
    });
  });

  it('writes only bio when name is omitted', async () => {
    const { svc, prisma } = build();
    prisma.user.findUnique.mockResolvedValue(existing);
    prisma.user.update.mockResolvedValue({ ...existing, bio: 'Hi.' });

    await svc.updateMyProfile('u-1', { bio: 'Hi.' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { bio: 'Hi.' },
    });
  });

  it('returns existing user without writing when DTO is empty', async () => {
    const { svc, prisma } = build();
    prisma.user.findUnique.mockResolvedValue(existing);

    const result = await svc.updateMyProfile('u-1', {});

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  // Type-system test: TypeScript prevents passing role/status/email at
  // the method signature level. This runtime test confirms that even if
  // a caller bypasses TS with `as any`, the method ignores forbidden
  // fields rather than letting them through.
  it('ignores fields outside the DTO contract (privilege escalation guard)', async () => {
    const { svc, prisma } = build();
    prisma.user.findUnique
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValue(existing);

    await svc.updateMyProfile('u-1', {
      name: 'Jane',
      // The cast simulates a malicious or buggy caller.
      ...({
        role: 'admin',
        status: 'banned',
        email: 'attacker@x.y',
        password: 'pwned',
        emailVerified: true,
      } as unknown as { name?: string; bio?: string }),
    });

    const firstCall = prisma.user.update.mock.calls[0] as unknown as [
      { data: Record<string, unknown> },
    ];
    const calledWith = firstCall[0];
    expect(calledWith.data).not.toHaveProperty('role');
    expect(calledWith.data).not.toHaveProperty('status');
    expect(calledWith.data).not.toHaveProperty('email');
    expect(calledWith.data).not.toHaveProperty('password');
    expect(calledWith.data).not.toHaveProperty('emailVerified');
  });
});

describe('UsersService.setProfilePicture', () => {
  it('writes only profilePicture', async () => {
    const { svc, prisma } = build();
    prisma.user.update.mockResolvedValue({ id: 'u-1' });

    await svc.setProfilePicture('u-1', 'http://cdn/avatars/x.png');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { profilePicture: 'http://cdn/avatars/x.png' },
    });
  });

  it('accepts null to clear', async () => {
    const { svc, prisma } = build();
    prisma.user.update.mockResolvedValue({ id: 'u-1' });

    await svc.setProfilePicture('u-1', null);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { profilePicture: null },
    });
  });
});

// Section: delete — soft delete + anonymise (SRS FR-USER-05)

const buildForDelete = () => {
  const original = {
    id: 'u-1',
    email: 'jane@example.com',
    username: 'jane',
    password: 'old-hash',
    status: 'active',
    profilePicture: 'avatars/u-1.webp',
    bio: 'Hi',
    googleProviderId: 'g-123',
    emailVerified: true,
  };
  const tx = {
    studySet: {
      findMany: jest.fn().mockResolvedValue([{ id: 'set-a' }, { id: 'set-b' }]),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    magicLink: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    user: {
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({ ...original, ...data }),
        ),
    },
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(original) },
    $transaction: jest
      .fn()
      .mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const svc = new UsersService(
    noopLogger(),
    prisma as unknown as PrismaService,
    queue as unknown as Queue<SearchSyncJobPayload>,
  );
  return { svc, prisma, tx, queue };
};

type UserUpdateArgs = { data: Record<string, unknown> };

describe('UsersService.delete', () => {
  it('soft-deletes and anonymises instead of removing the row', async () => {
    const { svc, tx } = buildForDelete();

    const { user } = await svc.delete('u-1');

    const { data } = (tx.user.update.mock.calls[0] as [UserUpdateArgs])[0];
    expect(data).toMatchObject({
      status: 'deleted',
      googleProviderId: null,
      profilePicture: null,
      bio: null,
      emailVerified: false,
    });
    expect(data.email).toMatch(/^deleted_[a-f0-9]{12}@deleted\.local$/);
    expect(data.username).toMatch(/^deleted_[a-f0-9]{12}$/);
    expect(data.password).not.toBe('old-hash');
    expect(user.email).not.toBe('jane@example.com');
  });

  it('makes every owned set private and drops published ones from search', async () => {
    const { svc, tx, queue } = buildForDelete();

    await svc.delete('u-1');

    expect(tx.studySet.updateMany).toHaveBeenCalledWith({
      where: { ownerId: 'u-1' },
      data: { visibility: 'PRIVATE' },
    });
    expect(queue.add).toHaveBeenCalledTimes(2);
    // One per-set sync job; the worker sees the set is private and drops it.
    expect(queue.add).toHaveBeenCalledWith(
      'search.sync_set',
      { setId: 'set-a' },
      { deduplication: { id: 'set-set-a', keepLastIfActive: true } },
    );
  });

  it('revokes all sessions and removes pending magic links', async () => {
    const { svc, tx } = buildForDelete();

    await svc.delete('u-1');

    const [revoke] = tx.refreshToken.updateMany.mock.calls[0] as [
      { where: unknown; data: { revokedAt: unknown } },
    ];
    expect(revoke.where).toEqual({ userId: 'u-1', revokedAt: null });
    expect(revoke.data.revokedAt).toBeInstanceOf(Date);
    expect(tx.magicLink.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u-1' },
    });
  });

  it('hands back the old avatar key so the caller can delete the object', async () => {
    const { svc } = buildForDelete();

    const { removedProfilePicture } = await svc.delete('u-1');

    expect(removedProfilePicture).toBe('avatars/u-1.webp');
  });

  it('404s for an unknown user without touching anything', async () => {
    const { svc, prisma } = buildForDelete();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(svc.delete('nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
