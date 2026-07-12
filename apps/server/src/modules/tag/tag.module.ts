import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UsersModule } from 'src/modules/users/user.module';

import { TagController } from './tag.controller';
import { TagService } from './tag.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
