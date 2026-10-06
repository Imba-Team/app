import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

const logger = new Logger('RedisConfig');

export interface ResolvedRedisConfig {
  /** URL string suitable for `new Redis(url, options)` — set when REDIS_URL is provided. */
  url?: string;
  /** Discrete host/port/password/tls options merged into ioredis / BullMQ connection. */
  options: RedisOptions;
}

/**
 * Flat RedisOptions form of the resolved config — used by BullMQ, which
 * only accepts a connection options object, not a URL string.
 */
export function resolveRedisConnectionOptions(
  cfg: ConfigService,
): RedisOptions {
  const { url, options } = resolveRedisConfig(cfg);
  if (!url) return options;
  try {
    const parsed = new URL(url);
    const port = parsed.port ? Number(parsed.port) : 6379;
    const tls = parsed.protocol === 'rediss:' ? {} : undefined;
    return {
      host: parsed.hostname,
      port,
      username: parsed.username
        ? decodeURIComponent(parsed.username)
        : undefined,
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : undefined,
      ...(tls ? { tls } : {}),
    };
  } catch {
    logger.warn(
      `REDIS_URL could not be parsed as a URL — falling back to REDIS_HOST/PORT.`,
    );
    return options;
  }
}

/**
 * Resolves Redis connection settings from env, tolerating a couple of
 * common misconfigurations:
 *
 *  - `REDIS_URL` (rediss:// or redis://) takes precedence when set. This
 *    is what Upstash, Render, and most managed providers hand out.
 *  - `REDIS_HOST` accidentally set to a full URL (e.g. copy/paste of the
 *    Upstash REST endpoint `https://xxx.upstash.io`) has its scheme
 *    stripped, and a warning is logged. Without this, ioredis attempts a
 *    DNS lookup on the literal `https://...` string and floods logs with
 *    ENOTFOUND errors.
 */
export function resolveRedisConfig(cfg: ConfigService): ResolvedRedisConfig {
  const url = cfg.get<string>('REDIS_URL');
  if (url && url.trim()) {
    return { url: url.trim(), options: {} };
  }

  const rawHost = cfg.get<string>('REDIS_HOST') ?? 'localhost';
  const port = Number(cfg.get<string | number>('REDIS_PORT') ?? 6379);
  const password = cfg.get<string>('REDIS_PASSWORD') || undefined;

  const host = stripSchemeFromHost(rawHost);

  return {
    options: {
      host,
      port,
      password,
    },
  };
}

function stripSchemeFromHost(host: string): string {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(host);
  if (!match) return host;
  const scheme = match[1];
  const stripped = host.slice(match[0].length).replace(/\/.*$/, '');
  logger.warn(
    `REDIS_HOST looks like a URL ("${host}"). Stripping the "${scheme}://" ` +
      `prefix and using "${stripped}" as the hostname. If your provider ` +
      'gave you a full connection string, set REDIS_URL instead.',
  );
  return stripped;
}
