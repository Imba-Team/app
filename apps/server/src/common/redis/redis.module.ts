import {
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { resolveRedisConfig } from './redis.config';

/**
 * Provides a singleton ioredis client at the application level.
 *
 * Reused by every feature that needs ad-hoc Redis state (login attempts,
 * rate limiters, cache layers, ...). BullMQ manages its own connection
 * internally; we deliberately keep that one separate from this one so
 * heavy queue traffic can't starve interactive Redis commands.
 *
 * `lazyConnect: true` so the client only opens a socket on first use —
 * keeps short-lived processes (the OpenAPI generator, unit-test boots)
 * from hanging forever when Redis isn't reachable, and shaves a few ms
 * off app startup when warm.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService): Redis => {
        const logger = new Logger('RedisClient');
        const { url, options } = resolveRedisConfig(cfg);
        const commonOptions = {
          ...options,
          lazyConnect: true,
          maxRetriesPerRequest: 5,
        };
        const client = url
          ? new Redis(url, commonOptions)
          : new Redis(commonOptions);

        client.on('error', (err) => {
          logger.warn(`Redis client error: ${err.message}`);
        });
        client.on('ready', () => {
          logger.log('Redis client connected');
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status === 'ready' || this.client.status === 'connecting') {
      await this.client.quit();
    } else {
      this.client.disconnect();
    }
  }
}
