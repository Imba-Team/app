import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CardMasteryStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';
import { FlashcardWithProgressDto } from './dtos/flashcard-with-progress.dto';

@Injectable()
export class FlashcardProgressService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
  ) {}

  async getProgress(
    userId: string,
    flashcardId: string,
  ): Promise<FlashcardWithProgressDto> {
    const flashcard = await this.prisma.flashcard.findUnique({
      where: { id: flashcardId },
    });
    if (!flashcard) throw new NotFoundException('Flashcard not found');

    const canAccess = await this.studySetService.canAccess(
      userId,
      flashcard.studySetId,
    );
    if (!canAccess) throw new ForbiddenException('Study set is private');

    const row = await this.prisma.userCardProgress.findUnique({
      where: { userId_cardId: { userId, cardId: flashcardId } },
    });

    return plainToInstance(
      FlashcardWithProgressDto,
      {
        id: flashcard.id,
        term: flashcard.term,
        definition: flashcard.definition,
        status: row?.status ?? CardMasteryStatus.NEW,
        weightedStreak: row?.weightedStreak.toString() ?? '0.00',
        isStarred: row?.isStarred ?? false,
        masteredAt: row?.masteredAt ?? null,
      },
      { excludeExtraneousValues: true },
    );
  }

  async setStarred(
    userId: string,
    flashcardId: string,
    isStarred: boolean,
  ): Promise<FlashcardWithProgressDto> {
    const flashcard = await this.prisma.flashcard.findUnique({
      where: { id: flashcardId },
    });
    if (!flashcard) throw new NotFoundException('Flashcard not found');

    const canAccess = await this.studySetService.canAccess(
      userId,
      flashcard.studySetId,
    );
    if (!canAccess) throw new ForbiddenException('Study set is private');

    const saved = await this.prisma.userCardProgress.upsert({
      where: { userId_cardId: { userId, cardId: flashcardId } },
      create: {
        userId,
        cardId: flashcardId,
        setId: flashcard.studySetId,
        isStarred,
      },
      update: { isStarred },
    });

    this.logger.log(
      `Star toggled: userId=${userId}, cardId=${flashcardId}, isStarred=${isStarred}`,
    );

    return plainToInstance(
      FlashcardWithProgressDto,
      {
        id: flashcard.id,
        term: flashcard.term,
        definition: flashcard.definition,
        status: saved.status,
        weightedStreak: saved.weightedStreak.toString(),
        isStarred: saved.isStarred,
        masteredAt: saved.masteredAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
