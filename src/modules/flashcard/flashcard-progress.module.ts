import { Module } from '@nestjs/common';
import { FlashcardProgressController } from './flashcard-progress.controller';
import { FlashcardProgressService } from './flashcard-progress.service';
import { AuthModule } from 'src/modules/auth/auth.module';
import { StudySetModule } from 'src/modules/study-set/study-set.module';
import { UsersModule } from 'src/modules/users/user.module';

@Module({
  imports: [AuthModule, UsersModule, StudySetModule],
  controllers: [FlashcardProgressController],
  providers: [FlashcardProgressService],
  exports: [FlashcardProgressService],
})
export class FlashcardModule {}
