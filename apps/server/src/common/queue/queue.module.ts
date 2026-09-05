import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  MAIL_QUEUE,
  SEARCH_SYNC_QUEUE,
  SRS_REMINDERS_QUEUE,
} from './queue.constants';
import { resolveRedisConnectionOptions } from '../redis/redis.config';

/**
 * Wires the BullMQ connection (Redis) and registers all queues we own.
 *
 * Made @Global() so any module can inject @InjectQueue(name) without
 * needing to re-import BullModule.registerQueue.
 *
 * Default job options enforce a sane retention + retry policy across
 * every queue. Individual jobs can still override these per-call.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          ...resolveRedisConnectionOptions(cfg),
          // Standardised reconnect — BullMQ uses ioredis under the hood.
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          // Keep the last 1k completed jobs (or 24h, whichever first) for
          // observability; drop everything older. Keep failed jobs longer
          // for debugging.
          removeOnComplete: { age: 24 * 3600, count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
        },
      }),
    }),
    BullModule.registerQueue({ name: MAIL_QUEUE }),
    BullModule.registerQueue({ name: SEARCH_SYNC_QUEUE }),
    BullModule.registerQueue({ name: SRS_REMINDERS_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
