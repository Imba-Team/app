import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { StudySetModule } from 'src/modules/study-set/study-set.module';
import { UsersModule } from 'src/modules/users/user.module';

import { CsvImportService } from './csv-import.service';
import { FlashcardController } from './flashcard.controller';
import { FlashcardProgressController } from './flashcard-progress.controller';
import { FlashcardProgressService } from './flashcard-progress.service';
import { FlashcardService } from './flashcard.service';
import { SetFlashcardsController } from './set-flashcards.controller';

@Module({
  imports: [AuthModule, UsersModule, StudySetModule],
  controllers: [
    FlashcardController,
    SetFlashcardsController,
    FlashcardProgressController,
  ],
  providers: [FlashcardService, FlashcardProgressService, CsvImportService],
  exports: [FlashcardService, FlashcardProgressService, CsvImportService],
})
export class FlashcardModule {}
