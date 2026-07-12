import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { LoggerService } from 'src/common/logger/logger.service';
import { REDIS_CLIENT } from 'src/common/redis/redis.constants';

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_MINUTES = 15;

/**
 * Tracks failed login attempts per account and enforces a 15-minute
 * lockout after five consecutive failures (defaults — both tunable via
 * env vars).
 *
 * Storage model:
 *   login:fail:<email>  INTEGER  — sliding-window counter, TTL = lockout window
 *   login:lock:<email>  "1"      — lock marker, TTL = lockout window
 *
 * The lock key is the source of truth that gates login. The counter key
 * exists only to decide *when* to set the lock key.
 *
 * Failure mode: if Redis is unreachable, all checks fail-OPEN (login is
 * allowed) and the incident is logged at WARN. The throttler still
 * provides per-IP rate limiting in that case, so login remains gated by
 * something. Failing closed would create a full-availability incident
 * the moment Redis hiccups, which is a worse trade-off in practice.
 */
@Injectable()
export class LoginAttemptsService {
  private readonly context = 'LoginAttemptsService';

  private readonly maxAttempts: number;
  private readonly lockoutMs: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    cfg: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(this.context);
    this.maxAttempts =
      Number(cfg.get<string>('LOGIN_MAX_ATTEMPTS')) || DEFAULT_MAX_ATTEMPTS;
    this.lockoutMs =
      (Number(cfg.get<string>('LOGIN_LOCKOUT_MINUTES')) ||
        DEFAULT_LOCKOUT_MINUTES) *
      60 *
      1000;
  }

  /**
   * Throws 429 if the account is currently locked. Always returns
   * cleanly on Redis failure (fail-open — see class comment).
   */
  async assertNotLocked(email: string): Promise<void> {
    const key = lockKey(email);
    let ttlSeconds: number;
    try {
      ttlSeconds = await this.redis.ttl(key);
    } catch (err) {
      this.logger.warn(
        `Redis unavailable for login-lockout check (fail-open): ${describe(err)}`,
      );
      return;
    }

    if (ttlSeconds > 0) {
      throw new HttpException(
        {
          ok: false,
          message:
            'Account is temporarily locked due to too many failed login attempts.',
          code: 'ACCOUNT_LOCKED',
          retryAfterSeconds: ttlSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Records a failed login attempt. Sets the lock key once the configured
   * threshold is crossed. The returned counter is the post-increment value
   * so callers can include it in logs.
   */
  async recordFailure(email: string): Promise<number> {
    const counter = counterKey(email);
    const lock = lockKey(email);
    const lockoutSeconds = Math.floor(this.lockoutMs / 1000);

    try {
      // INCR + EXPIRE the counter atomically — EXPIRE is a no-op when
      // the key already has a TTL, so the sliding window behaviour
      // restarts on each failure.
      const pipeline = this.redis.multi();
      pipeline.incr(counter);
      pipeline.expire(counter, lockoutSeconds);
      const results = await pipeline.exec();
      const count = Number(results?.[0]?.[1] ?? 0);

      if (count >= this.maxAttempts) {
        await this.redis.set(lock, '1', 'EX', lockoutSeconds);
        this.logger.warn(
          `Account locked: email=${email} after ${count} failed attempts ` +
            `(window=${lockoutSeconds}s)`,
        );
      }

      return count;
    } catch (err) {
      this.logger.warn(
        `Redis unavailable for login-failure record (skipped): ${describe(err)}`,
      );
      return 0;
    }
  }

  /** Clears both counter and lock on a successful login. */
  async recordSuccess(email: string): Promise<void> {
    try {
      await this.redis.del(counterKey(email), lockKey(email));
    } catch (err) {
      this.logger.warn(
        `Redis unavailable for login-success reset (skipped): ${describe(err)}`,
      );
    }
  }
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function counterKey(email: string): string {
  return `login:fail:${normalize(email)}`;
}

function lockKey(email: string): string {
  return `login:lock:${normalize(email)}`;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}
