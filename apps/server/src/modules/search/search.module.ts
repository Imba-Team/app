import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';

import { SEARCH_SYNC_QUEUE } from 'src/common/queue/queue.constants';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UsersModule } from 'src/modules/users/user.module';

import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchSyncProcessor } from './search-sync.processor';
import { SearchSyncService } from './search-sync.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    BullModule.registerQueue({ name: SEARCH_SYNC_QUEUE }),
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        node: cfg.get<string>('ELASTICSEARCH_NODE') ?? 'http://localhost:9200',
        auth: cfg.get<string>('ELASTICSEARCH_USERNAME')
          ? {
              username: cfg.get<string>('ELASTICSEARCH_USERNAME')!,
              password: cfg.get<string>('ELASTICSEARCH_PASSWORD') ?? '',
            }
          : undefined,
        // Single-attempt request — BullMQ handles retry semantics for sync
        // jobs, and the search endpoint should fail fast for the user.
        maxRetries: 0,
        requestTimeout: 5000,
      }),
    }),
  ],
  controllers: [SearchController],
  providers: [SearchService, SearchSyncService, SearchSyncProcessor],
  exports: [SearchService, SearchSyncService],
})
export class SearchModule {}
