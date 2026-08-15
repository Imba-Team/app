import { Module } from '@nestjs/common';

import { AuthModule } from 'src/modules/auth/auth.module';
import { StudySetModule } from 'src/modules/study-set/study-set.module';
import { UsersModule } from 'src/modules/users/user.module';

import { TestPreferencesController } from './test-preferences.controller';
import { TestPreferencesService } from './test-preferences.service';

@Module({
  imports: [AuthModule, UsersModule, StudySetModule],
  controllers: [TestPreferencesController],
  providers: [TestPreferencesService],
  exports: [TestPreferencesService],
})
export class TestPreferencesModule {}
