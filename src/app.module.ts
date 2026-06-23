import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './modules/users/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { LoggerModule } from './common/logger/logger.module';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { LearningModule } from './modules/learning/learning.module';
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
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    LoggerModule,
    PrismaModule,
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
    SrsModule,
    AiModule,
    ClassroomModule,
    SearchModule,
    NotificationModule,
    AnalyticsModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
})
export class AppModule {}
