import { Module } from '@nestjs/common';

import { AuthModule } from 'src/modules/auth/auth.module';
import { FolderModule } from 'src/modules/folder/folder.module';
import { StudySetModule } from 'src/modules/study-set/study-set.module';
import { UsersModule } from 'src/modules/users/user.module';

import { FolderStudySetController } from './folder-study-set.controller';
import { FolderStudySetService } from './folder-study-set.service';

@Module({
  imports: [FolderModule, AuthModule, UsersModule, StudySetModule],
  controllers: [FolderStudySetController],
  providers: [FolderStudySetService],
  exports: [FolderStudySetService],
})
export class FolderStudySetModule {}
