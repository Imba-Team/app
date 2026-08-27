import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { StudySetModule } from 'src/modules/study-set/study-set.module';
import { UsersModule } from 'src/modules/users/user.module';
import { SetPreferencesModule } from 'src/modules/set-preferences/set-preferences.module';
import { SrsModule } from 'src/modules/srs/srs.module';

import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { SessionController } from './session.controller';
import { SetProgressController } from './set-progress.controller';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    StudySetModule,
    SetPreferencesModule,
    SrsModule,
  ],
  controllers: [LearningController, SessionController, SetProgressController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}
