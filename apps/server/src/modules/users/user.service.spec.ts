import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
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

  it('writes only name (mapped to username) when bio is omitted', async () => {
    const { svc, prisma } = build();
    prisma.user.findUnique
      .mockResolvedValueOnce(existing) // findById
      .mockResolvedValueOnce(null); // allocateUsername collision check
    prisma.user.update.mockResolvedValue({
      ...existing,
      username: 'jane-doe',
    });

    await svc.updateMyProfile('u-1', { name: 'Jane Doe' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { username: 'jane-doe' },
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
