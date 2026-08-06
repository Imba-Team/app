import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { MagicLinkPurpose, MagicLinkService } from './magic-link.service';
import { LoginAttemptsService } from './login-attempts.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { UsersService } from 'src/modules/users/user.service';
import { LoggerService } from 'src/common/logger/logger.service';

const noopLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
  }) as unknown as LoggerService;

const noopConfig = (env: Record<string, string> = {}) =>
  ({
    get: jest.fn((key: string) => env[key]),
  }) as unknown as ConfigService;

const fakeReq = (): Request =>
  ({
    get: jest.fn().mockReturnValue(undefined),
    ip: '127.0.0.1',
  }) as unknown as Request;

interface PrismaMock {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  refreshToken: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
}

const makePrisma = (): PrismaMock => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
});

const buildService = (
  overrides: {
    prisma?: PrismaMock;
    usersService?: Partial<UsersService>;
    jwt?: Partial<JwtService>;
    loginAttempts?: Partial<LoginAttemptsService>;
    magicLink?: Partial<MagicLinkService>;
    config?: ConfigService;
  } = {},
) => {
  const prisma = overrides.prisma ?? makePrisma();
  const usersService =
    overrides.usersService ??
    ({
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    } as unknown as UsersService);
  const jwt =
    overrides.jwt ??
    ({
      sign: jest.fn().mockReturnValue('access-jwt-stub'),
      verify: jest.fn(),
    } as unknown as JwtService);
  const loginAttempts =
    overrides.loginAttempts ??
    ({
      assertNotLocked: jest.fn().mockResolvedValue(undefined),
      recordFailure: jest.fn().mockResolvedValue(1),
      recordSuccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as LoginAttemptsService);
  const magicLink =
    overrides.magicLink ??
    ({
      sendVerificationLink: jest.fn(),
      verifyToken: jest.fn(),
    } as unknown as MagicLinkService);
  const config = overrides.config ?? noopConfig();

  const svc = new AuthService(
    config,
    jwt as JwtService,
    magicLink as MagicLinkService,
    noopLogger(),
    usersService as UsersService,
    prisma as unknown as PrismaService,
    loginAttempts as LoginAttemptsService,
  );

  return { svc, prisma, usersService, jwt, loginAttempts, magicLink };
};

describe('AuthService.login', () => {
  it('throws INVALID_CREDENTIALS (401) and bumps counter on unknown email', async () => {
    const { svc, usersService, loginAttempts } = buildService({
      usersService: {
        findByEmail: jest.fn().mockResolvedValue(null),
      } as unknown as UsersService,
    });

    let caught: UnauthorizedException | undefined;
    try {
      await svc.login({ email: 'unknown@x.y', password: 'pw' }, fakeReq());
    } catch (e) {
      caught = e as UnauthorizedException;
    }
    expect(caught).toBeInstanceOf(UnauthorizedException);
    const body = caught?.getResponse() as { code: string };
    expect(body.code).toBe('INVALID_CREDENTIALS');
    expect(loginAttempts.recordFailure).toHaveBeenCalledWith('unknown@x.y');
    expect(usersService.findByEmail).toHaveBeenCalledWith('unknown@x.y');
  });

  it('throws INVALID_CREDENTIALS on wrong password and bumps counter', async () => {
    const hashed = await bcrypt.hash('right-password', 4);
    const { svc, loginAttempts } = buildService({
      usersService: {
        findByEmail: jest.fn().mockResolvedValue({
          id: 'u-1',
          email: 'a@b.c',
          password: hashed,
          emailVerified: true,
        }),
      } as unknown as UsersService,
    });

    await expect(
      svc.login({ email: 'a@b.c', password: 'wrong' }, fakeReq()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(loginAttempts.recordFailure).toHaveBeenCalledWith('a@b.c');
  });

  it('throws EMAIL_NOT_VERIFIED (403) and does NOT bump counter', async () => {
    const hashed = await bcrypt.hash('pw', 4);
    const { svc, loginAttempts } = buildService({
      usersService: {
        findByEmail: jest.fn().mockResolvedValue({
          id: 'u-1',
          email: 'a@b.c',
          password: hashed,
          emailVerified: false,
        }),
      } as unknown as UsersService,
    });

    let caught: ForbiddenException | undefined;
    try {
      await svc.login({ email: 'a@b.c', password: 'pw' }, fakeReq());
    } catch (e) {
      caught = e as ForbiddenException;
    }
    expect(caught).toBeInstanceOf(ForbiddenException);
    const body = caught?.getResponse() as { code: string };
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(loginAttempts.recordFailure).not.toHaveBeenCalled();
  });

  it('rejects with ACCOUNT_LOCKED before touching DB when locked', async () => {
    const lockErr = new Error('locked');
    const findByEmail = jest.fn();
    const usersService = { findByEmail } as unknown as UsersService;
    const loginAttempts = {
      assertNotLocked: jest.fn().mockRejectedValue(lockErr),
      recordFailure: jest.fn(),
      recordSuccess: jest.fn(),
    } as unknown as LoginAttemptsService;
    const { svc } = buildService({ usersService, loginAttempts });

    await expect(
      svc.login({ email: 'a@b.c', password: 'pw' }, fakeReq()),
    ).rejects.toBe(lockErr);
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it('issues a session on the happy path + clears the failure counter', async () => {
    const hashed = await bcrypt.hash('pw', 4);
    const prisma = makePrisma();
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

    const { svc, loginAttempts, jwt } = buildService({
      prisma,
      usersService: {
        findByEmail: jest.fn().mockResolvedValue({
          id: 'u-1',
          email: 'a@b.c',
          password: hashed,
          emailVerified: true,
        }),
      } as unknown as UsersService,
    });

    const result = await svc.login(
      { email: 'a@b.c', password: 'pw' },
      fakeReq(),
    );

    expect(result.accessToken).toBe('access-jwt-stub');
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.email).toBe('a@b.c');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u-1', sid: expect.any(String) }),
    );
    expect(loginAttempts.recordSuccess).toHaveBeenCalledWith('a@b.c');
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService.rotateRefreshToken', () => {
  it('throws REFRESH_INVALID when token not found', async () => {
    const prisma = makePrisma();
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    const { svc } = buildService({ prisma });

    let caught: UnauthorizedException | undefined;
    try {
      await svc.rotateRefreshToken('nope', {
        userAgent: 'ua',
        ipAddress: 'ip',
      });
    } catch (e) {
      caught = e as UnauthorizedException;
    }
    expect(caught).toBeInstanceOf(UnauthorizedException);
    expect((caught?.getResponse() as { code: string }).code).toBe(
      'REFRESH_INVALID',
    );
  });

  it('detects replay: revokes entire family when an already-revoked token is presented', async () => {
    const prisma = makePrisma();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'u-1',
      familyId: 'fam-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { svc } = buildService({ prisma });

    let caught: UnauthorizedException | undefined;
    try {
      await svc.rotateRefreshToken('replayed', {
        userAgent: 'ua',
        ipAddress: 'ip',
      });
    } catch (e) {
      caught = e as UnauthorizedException;
    }
    expect(caught).toBeInstanceOf(UnauthorizedException);
    expect((caught?.getResponse() as { code: string }).code).toBe(
      'REFRESH_REPLAY',
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'fam-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('throws REFRESH_INVALID when token has expired', async () => {
    const prisma = makePrisma();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'u-1',
      familyId: 'fam-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    const { svc } = buildService({ prisma });

    await expect(
      svc.rotateRefreshToken('expired', { userAgent: 'ua', ipAddress: 'ip' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('happy path: issues new refresh + access, revokes old row, links via replacedByTokenId', async () => {
    const prisma = makePrisma();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-old',
      userId: 'u-1',
      familyId: 'fam-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-new' });
    prisma.refreshToken.findUniqueOrThrow.mockResolvedValue({ id: 'rt-new' });

    const { svc } = buildService({ prisma });
    const result = await svc.rotateRefreshToken('current', {
      userAgent: 'ua',
      ipAddress: 'ip',
    });

    expect(result.accessToken).toBe('access-jwt-stub');
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-old' },
      data: {
        revokedAt: expect.any(Date),
        replacedByTokenId: 'rt-new',
      },
    });
  });
});

describe('AuthService.verifyEmail', () => {
  it('marks user verified and sets verifiedAt', async () => {
    const prisma = makePrisma();
    prisma.user.update.mockResolvedValue({});
    const { svc } = buildService({
      prisma,
      magicLink: {
        verifyToken: jest.fn().mockResolvedValue({
          ok: true,
          data: { userId: 'u-1' },
        }),
      } as unknown as MagicLinkService,
      usersService: {
        findById: jest.fn().mockResolvedValue({
          id: 'u-1',
          email: 'a@b.c',
          emailVerified: false,
        }),
      } as unknown as UsersService,
    });

    const result = await svc.verifyEmail('tok');
    expect(result.email).toBe('a@b.c');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { emailVerified: true, verifiedAt: expect.any(Date) },
    });
  });

  it('is idempotent — no DB write if already verified', async () => {
    const prisma = makePrisma();
    const { svc } = buildService({
      prisma,
      magicLink: {
        verifyToken: jest.fn().mockResolvedValue({
          ok: true,
          data: { userId: 'u-1' },
        }),
      } as unknown as MagicLinkService,
      usersService: {
        findById: jest.fn().mockResolvedValue({
          id: 'u-1',
          email: 'a@b.c',
          emailVerified: true,
        }),
      } as unknown as UsersService,
    });

    const result = await svc.verifyEmail('tok');
    expect(result.email).toBe('a@b.c');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('AuthService.register', () => {
  it('rejects when email already in use', async () => {
    const { svc, magicLink } = buildService({
      usersService: {
        findByEmail: jest.fn().mockResolvedValue({ id: 'u-1' }),
        create: jest.fn(),
      } as unknown as UsersService,
    });

    await expect(
      svc.register({
        username: 'x',
        email: 'taken@example.com',
        password: 'pw1234',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(magicLink.sendVerificationLink).not.toHaveBeenCalled();
  });

  it('dispatches a verification email on new registrations', async () => {
    const { svc, magicLink } = buildService({
      usersService: {
        findByEmail: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'u-1', email: 'new@x.y' }),
      } as unknown as UsersService,
    });

    const result = await svc.register({
      username: 'x',
      email: 'new@x.y',
      password: 'pw1234',
    });
    expect(result.email).toBe('new@x.y');
    expect(magicLink.sendVerificationLink).toHaveBeenCalledWith({
      to: 'new@x.y',
      userId: 'u-1',
      purpose: MagicLinkPurpose.EMAIL_VERIFICATION,
    });
  });
});

describe('AuthService.resolveGoogleUser', () => {
  it('returns existing user when googleProviderId already matches', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', email: 'g@x.y' });
    const { svc } = buildService({ prisma });

    const result = await svc.resolveGoogleUser({
      providerId: 'gid-1',
      email: 'g@x.y',
    });
    expect(result.id).toBe('u-1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { googleProviderId: 'gid-1' },
    });
  });

  it('silently links Google id to existing email-only account', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({
      id: 'u-1',
      email: 'a@b.c',
      googleProviderId: 'gid-1',
    });
    const { svc } = buildService({
      prisma,
      usersService: {
        findByEmail: jest.fn().mockResolvedValue({
          id: 'u-1',
          email: 'a@b.c',
          googleProviderId: null,
          emailVerified: false,
          profilePicture: null,
          verifiedAt: null,
        }),
      } as unknown as UsersService,
    });

    const result = await svc.resolveGoogleUser({
      providerId: 'gid-1',
      email: 'a@b.c',
      picture: 'pic.png',
    });
    expect(result.googleProviderId).toBe('gid-1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({
        googleProviderId: 'gid-1',
        emailVerified: true,
        verifiedAt: expect.any(Date),
      }),
    });
  });

  it('throws GOOGLE_LINK_CONFLICT when same email already linked to different Google id', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const { svc } = buildService({
      prisma,
      usersService: {
        findByEmail: jest.fn().mockResolvedValue({
          id: 'u-1',
          email: 'a@b.c',
          googleProviderId: 'OTHER-GID',
        }),
      } as unknown as UsersService,
    });

    let caught: ConflictException | undefined;
    try {
      await svc.resolveGoogleUser({
        providerId: 'NEW-GID',
        email: 'a@b.c',
      });
    } catch (e) {
      caught = e as ConflictException;
    }
    expect(caught).toBeInstanceOf(ConflictException);
    const body = caught?.getResponse() as { code: string };
    expect(body.code).toBe('GOOGLE_LINK_CONFLICT');
  });
});
