import { Module } from '@nestjs/common';

import { AuthModule } from 'src/modules/auth/auth.module';
import { LoggerModule } from 'src/common/logger/logger.module';
import { StudySetModule } from 'src/modules/study-set/study-set.module';
import { UsersModule } from 'src/modules/users/user.module';

import { FavouriteStudySetController } from './favourite-study-set.controller';
import { FavouriteStudySetService } from './favourite-study-set.service';

@Module({
  imports: [AuthModule, LoggerModule, StudySetModule, UsersModule],
  controllers: [FavouriteStudySetController],
  providers: [FavouriteStudySetService],
  exports: [FavouriteStudySetService],
})
export class FavouriteStudySetModule {}
