import { ExecutionContext, HttpException } from '@nestjs/common';
import { LoggerService } from 'src/common/logger/logger.service';
import { AuthService } from 'src/modules/auth/auth.service';
import { UsersService } from 'src/modules/users/user.service';
import { JwtGuard } from './jwt.guard';

const noopLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as LoggerService;

const build = (status: string) => {
  const authService = {
    verifyToken: jest.fn().mockReturnValue({ sub: 'u-1', sid: 'fam-1' }),
  };
  const usersService = {
    findById: jest.fn().mockResolvedValue({ id: 'u-1', status }),
  };
  const request: Record<string, unknown> = { cookies: { token: 'jwt' } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const guard = new JwtGuard(
    authService as unknown as AuthService,
    noopLogger(),
    usersService as unknown as UsersService,
  );
  return { guard, context, request };
};

describe('JwtGuard', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('lets an active user through', async () => {
    const { guard, context, request } = build('active');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'u-1' });
  });

  it('rejects a still-valid token belonging to a deleted account', async () => {
    const { guard, context, request } = build('deleted');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(request.user).toBeUndefined();
  });
});
