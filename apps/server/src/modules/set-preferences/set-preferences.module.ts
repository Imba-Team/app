import { Module } from '@nestjs/common';

import { AuthModule } from 'src/modules/auth/auth.module';
import { StudySetModule } from 'src/modules/study-set/study-set.module';
import { UsersModule } from 'src/modules/users/user.module';

import { SetPreferencesController } from './set-preferences.controller';
import { SetPreferencesService } from './set-preferences.service';

@Module({
  imports: [AuthModule, UsersModule, StudySetModule],
  controllers: [SetPreferencesController],
  providers: [SetPreferencesService],
  exports: [SetPreferencesService],
})
export class SetPreferencesModule {}
