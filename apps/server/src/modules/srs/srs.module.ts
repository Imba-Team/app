import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UsersModule } from 'src/modules/users/user.module';

import { SrsController } from './srs.controller';
import { SrsRemindersProcessor } from './srs-reminders.processor';
import { SrsRemindersScheduler } from './srs-reminders.scheduler';
import { SrsService } from './srs.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [SrsController],
  providers: [SrsService, SrsRemindersProcessor, SrsRemindersScheduler],
  exports: [SrsService],
})
export class SrsModule {}
