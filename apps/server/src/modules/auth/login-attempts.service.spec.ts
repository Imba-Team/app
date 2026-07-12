import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginAttemptsService } from './login-attempts.service';

interface RedisMock {
  ttl: jest.Mock;
  multi: jest.Mock;
  exec: jest.Mock;
  expire: jest.Mock;
  incr: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
}

const makeRedis = (): RedisMock => {
  const mock: Partial<RedisMock> = {
    ttl: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };
  // multi() returns an object with chained incr/expire and exec
  mock.multi = jest.fn(() => ({
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([[null, 1]]),
  }));
  return mock as RedisMock;
};

const makeConfig = (overrides: Record<string, string> = {}): ConfigService =>
  ({
    get: jest.fn((key: string) => overrides[key]),
  }) as unknown as ConfigService;

const fakeLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
  }) as unknown as import('src/common/logger/logger.service').LoggerService;

describe('LoginAttemptsService', () => {
  describe('assertNotLocked', () => {
    it('passes when no lock key exists (ttl <= 0)', async () => {
      const redis = makeRedis();
      redis.ttl.mockResolvedValue(-2);
      const svc = new LoginAttemptsService(
        redis as never,
        makeConfig(),
        fakeLogger(),
      );

      await expect(svc.assertNotLocked('x@y.z')).resolves.toBeUndefined();
    });

    it('throws 429 ACCOUNT_LOCKED when ttl > 0', async () => {
      const redis = makeRedis();
      redis.ttl.mockResolvedValue(620);
      const svc = new LoginAttemptsService(
        redis as never,
        makeConfig(),
        fakeLogger(),
      );

      let caught: HttpException | undefined;
      try {
        await svc.assertNotLocked('x@y.z');
      } catch (e) {
        caught = e as HttpException;
      }
      expect(caught).toBeInstanceOf(HttpException);
      expect(caught?.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const body = caught?.getResponse() as {
        code: string;
        retryAfterSeconds: number;
      };
      expect(body.code).toBe('ACCOUNT_LOCKED');
      expect(body.retryAfterSeconds).toBe(620);
    });

    it('fails OPEN when Redis throws (does not raise)', async () => {
      const redis = makeRedis();
      redis.ttl.mockRejectedValue(new Error('connection refused'));
      const svc = new LoginAttemptsService(
        redis as never,
        makeConfig(),
        fakeLogger(),
      );

      await expect(svc.assertNotLocked('x@y.z')).resolves.toBeUndefined();
    });
  });

  describe('recordFailure', () => {
    it('increments counter; does not lock below threshold', async () => {
      const redis = makeRedis();
      // multi().exec() returns [[null, 3]] meaning counter is now 3
      redis.multi.mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 3]]),
      });
      const svc = new LoginAttemptsService(
        redis as never,
        makeConfig(),
        fakeLogger(),
      );

      const count = await svc.recordFailure('x@y.z');
      expect(count).toBe(3);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('sets lock key once threshold reached', async () => {
      const redis = makeRedis();
      redis.multi.mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 5]]),
      });
      const svc = new LoginAttemptsService(
        redis as never,
        makeConfig({ LOGIN_MAX_ATTEMPTS: '5', LOGIN_LOCKOUT_MINUTES: '15' }),
        fakeLogger(),
      );

      await svc.recordFailure('x@y.z');
      expect(redis.set).toHaveBeenCalledWith(
        'login:lock:x@y.z',
        '1',
        'EX',
        15 * 60,
      );
    });

    it('normalises email (lowercase + trim)', async () => {
      const redis = makeRedis();
      redis.multi.mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 5]]),
      });
      const svc = new LoginAttemptsService(
        redis as never,
        makeConfig({ LOGIN_MAX_ATTEMPTS: '5', LOGIN_LOCKOUT_MINUTES: '15' }),
        fakeLogger(),
      );

      await svc.recordFailure('  X@Y.Z  ');
      expect(redis.set).toHaveBeenCalledWith(
        'login:lock:x@y.z',
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('fails OPEN when Redis throws — returns 0, no exception', async () => {
      const redis = makeRedis();
      redis.multi.mockImplementation(() => {
        throw new Error('boom');
      });
      const svc = new LoginAttemptsService(
        redis as never,
        makeConfig(),
        fakeLogger(),
      );

      await expect(svc.recordFailure('x@y.z')).resolves.toBe(0);
    });
  });

  describe('recordSuccess', () => {
    it('deletes counter and lock keys', async () => {
      const redis = makeRedis();
      const svc = new LoginAttemptsService(
        redis as never,
        makeConfig(),
        fakeLogger(),
      );

      await svc.recordSuccess('x@y.z');
      expect(redis.del).toHaveBeenCalledWith(
        'login:fail:x@y.z',
        'login:lock:x@y.z',
      );
    });

    it('fails OPEN when Redis throws', async () => {
      const redis = makeRedis();
      redis.del.mockRejectedValue(new Error('boom'));
      const svc = new LoginAttemptsService(
        redis as never,
        makeConfig(),
        fakeLogger(),
      );

      await expect(svc.recordSuccess('x@y.z')).resolves.toBeUndefined();
    });
  });
});
