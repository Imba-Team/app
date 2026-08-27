import { Module } from '@nestjs/common';
import { UsersModule } from 'src/modules/users/user.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { SearchModule } from 'src/modules/search/search.module';
import { StudySetController } from './study-set.controller';
import { StudySetService } from './study-set.service';
import { StudyHealthController } from './study-health.controller';

@Module({
  imports: [UsersModule, AuthModule, SearchModule],
  controllers: [StudySetController, StudyHealthController],
  providers: [StudySetService],
  exports: [StudySetService],
})
export class StudySetModule {}
