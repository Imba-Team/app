import { Module } from '@nestjs/common';

import { AuthModule } from 'src/modules/auth/auth.module';
import { UsersModule } from 'src/modules/users/user.module';

import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [FolderController],
  providers: [FolderService],
  exports: [FolderService],
})
export class FolderModule {}
