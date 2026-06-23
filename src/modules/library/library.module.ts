import { Module } from '@nestjs/common';

import { AuthModule } from 'src/modules/auth/auth.module';
import { FavouriteStudySetModule } from 'src/modules/favourite-study-set/favourite-study-set.module';
import { LoggerModule } from 'src/common/logger/logger.module';
import { StudySetModule } from 'src/modules/study-set/study-set.module';
import { UsersModule } from 'src/modules/users/user.module';

import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

@Module({
  imports: [
    AuthModule,
    LoggerModule,
    StudySetModule,
    FavouriteStudySetModule,
    UsersModule,
  ],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
