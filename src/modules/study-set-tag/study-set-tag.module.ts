import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { StudySetModule } from 'src/modules/study-set/study-set.module';
import { UsersModule } from 'src/modules/users/user.module';

import { TagModule } from '../tag/tag.module';
import { StudySetTagController } from './study-set-tag.controller';
import { StudySetTagService } from './study-set-tag.service';

@Module({
  imports: [TagModule, AuthModule, UsersModule, StudySetModule],
  controllers: [StudySetTagController],
  providers: [StudySetTagService],
  exports: [StudySetTagService],
})
export class StudySetTagModule {}
