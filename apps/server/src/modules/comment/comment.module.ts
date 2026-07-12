import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { StudySetModule } from 'src/modules/study-set/study-set.module';
import { UsersModule } from 'src/modules/users/user.module';

import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { StudySetCommentController } from './study-set-comment.controller';

@Module({
  imports: [AuthModule, UsersModule, StudySetModule],
  controllers: [StudySetCommentController, CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
