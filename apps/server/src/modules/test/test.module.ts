import { Module } from '@nestjs/common';

import { AuthModule } from 'src/modules/auth/auth.module';
import { SrsModule } from 'src/modules/srs/srs.module';
import { StudySetModule } from 'src/modules/study-set/study-set.module';
import { TestPreferencesModule } from 'src/modules/test-preferences/test-preferences.module';
import { UsersModule } from 'src/modules/users/user.module';

import { TestController } from './test.controller';
import { TestService } from './test.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    StudySetModule,
    TestPreferencesModule,
    SrsModule,
  ],
  controllers: [TestController],
  providers: [TestService],
  exports: [TestService],
})
export class TestModule {}
