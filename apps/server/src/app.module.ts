import * as path from 'node:path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './modules/users/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { LoggerModule } from './common/logger/logger.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { StudySetModule } from './modules/study-set/study-set.module';
import { FlashcardModule } from './modules/flashcard/flashcard-progress.module';
import { FavouriteStudySetModule } from './modules/favourite-study-set/favourite-study-set.module';
import { LibraryModule } from './modules/library/library.module';
import { TagModule } from './modules/tag/tag.module';
import { StudySetTagModule } from './modules/study-set-tag/study-set-tag.module';
import { FolderModule } from './modules/folder/folder.module';
import { FolderStudySetModule } from './modules/folder-study-set/folder-study-set.module';
import { CommentModule } from './modules/comment/comment.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './common/health/health.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { QueueModule } from './common/queue/queue.module';
import { MailModule } from './common/mail/mail.module';
import { RedisModule } from './common/redis/redis.module';
import { StorageModule } from './common/storage/storage.module';
import { MediaModule } from './common/media/media.module';
import { LearningModule } from './modules/learning/learning.module';
import { SetPreferencesModule } from './modules/set-preferences/set-preferences.module';
import { TestPreferencesModule } from './modules/test-preferences/test-preferences.module';
import { TestModule } from './modules/test/test.module';
import { SrsModule } from './modules/srs/srs.module';
import { AiModule } from './modules/ai/ai.module';
import { ClassroomModule } from './modules/classroom/classroom.module';
import { SearchModule } from './modules/search/search.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'), // folder on disk
      serveRoot: '/uploads', // public URL path root
    }),
    // Single global throttler. Auth-sensitive routes opt into a stricter
    // limit via @Throttle({ default: { limit, ttl } }) — applying multiple
    // named throttlers globally would force every non-auth route to also
    // be capped at the auth limit, which is not what we want.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl:
              (Number(cfg.get<string>('DEFAULT_THROTTLE_TTL_SECONDS')) || 60) *
              1000,
            limit: Number(cfg.get<string>('DEFAULT_THROTTLE_LIMIT')) || 100,
          },
        ],
      }),
    }),
    LoggerModule,
    PrismaModule,
    MetricsModule,
    RedisModule,
    StorageModule,
    MediaModule,
    QueueModule,
    MailModule,
    HealthModule,
    UsersModule,
    AuthModule,
    StudySetModule,
    FlashcardModule,
    FavouriteStudySetModule,
    LibraryModule,
    TagModule,
    StudySetTagModule,
    FolderModule,
    FolderStudySetModule,
    CommentModule,
    LearningModule,
    SetPreferencesModule,
    TestPreferencesModule,
    TestModule,
    SrsModule,
    AiModule,
    ClassroomModule,
    SearchModule,
    NotificationModule,
    AnalyticsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), '../../.env'),
    }),
  ],
  providers: [
    // Globally enforce the named throttlers. Per-route decorators can
    // opt into a specific named throttler (e.g. the stricter `auth` one)
    // via @Throttle({ auth: { ... } }).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
