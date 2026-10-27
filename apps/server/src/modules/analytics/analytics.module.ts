import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UsersModule } from 'src/modules/users/user.module';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ProgressController } from './progress.controller';
import { ProgressSnapshotProcessor } from './progress-snapshot.processor';
import { ProgressSnapshotScheduler } from './progress-snapshot.scheduler';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AnalyticsController, ProgressController],
  providers: [
    AnalyticsService,
    ProgressSnapshotProcessor,
    ProgressSnapshotScheduler,
  ],
})
export class AnalyticsModule {}
