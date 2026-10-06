import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  MAIL_QUEUE,
  SEARCH_SYNC_QUEUE,
  SRS_REMINDERS_QUEUE,
} from './queue.constants';

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
      useFactory: (cfg: ConfigService) => {
        const redisUrl = cfg.get<string>('REDIS_URL');
        const connection = redisUrl
          ? {
              url: redisUrl,
              maxRetriesPerRequest: null,
              enableReadyCheck: true,
            }
          : {
              host: cfg.get<string>('REDIS_HOST') ?? 'localhost',
              port: cfg.get<number>('REDIS_PORT') ?? 6379,
              password: cfg.get<string>('REDIS_PASSWORD') || undefined,
              maxRetriesPerRequest: null,
              enableReadyCheck: true,
            };
        return {
          connection,
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: { age: 24 * 3600, count: 1000 },
            removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
          },
        };
      },
    }),
    BullModule.registerQueue({ name: MAIL_QUEUE }),
    BullModule.registerQueue({ name: SEARCH_SYNC_QUEUE }),
    BullModule.registerQueue({ name: SRS_REMINDERS_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
