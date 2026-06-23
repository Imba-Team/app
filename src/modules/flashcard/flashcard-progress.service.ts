import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';
import { UpdateFlashcardProgressDto } from './dtos/update-flashcard-progress.dto';
import { plainToInstance } from 'class-transformer';
import { FlashcardWithProgressDto } from './dtos/flashcard-with-progress.dto';
import {
  confidenceToStatus,
  nextStatusAfterAnswer,
  statusToConfidence,
} from 'src/infrastructure/persistence/flashcard-user-state.mapper';

@Injectable()
export class FlashcardProgressService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
  ) {}

  async updateProgress(
    userId: string,
    flashcardId: string,
    dto: UpdateFlashcardProgressDto,
  ): Promise<FlashcardWithProgressDto> {
    const flashcard = await this.prisma.flashcard.findUnique({
      where: { id: flashcardId },
    });
    if (!flashcard) {
      throw new NotFoundException('Flashcard not found');
    }

    const studySet = await this.prisma.studySet.findUnique({
      where: { id: flashcard.studySetId },
    });

    if (!studySet) {
      throw new NotFoundException('Study set not found');
    }

    const isOwner = await this.isStudySetOwner(userId, studySet.id);
    const canAccess = await this.studySetService.canAccess(userId, studySet.id);
    if (!canAccess) {
      throw new ForbiddenException('Study set is private');
    }

    if (!isOwner) {
      const inCollection = await this.prisma.favouriteStudySet.findUnique({
        where: {
          userId_studySetId: { userId, studySetId: studySet.id },
        },
      });

      if (!inCollection) {
        throw new ForbiddenException(
          'Add the study set to your collection first',
        );
      }
    } else {
      await this.ensureProgressRecords(userId, studySet.id);
    }

    let state = await this.prisma.flashcardUserState.findUnique({
      where: { userId_flashcardId: { userId, flashcardId } },
    });

    if (!state) {
      state = await this.prisma.flashcardUserState.create({
        data: {
          userId,
          flashcardId,
        },
      });
    }

    if (dto.status) {
      state.confidenceLevel = statusToConfidence(dto.status);
    }

    if (dto.isStarred !== undefined) {
      state.isStarred = dto.isStarred;
    }

    const saved = await this.prisma.flashcardUserState.update({
      where: { id: state.id },
      data: {
        confidenceLevel: state.confidenceLevel,
        isStarred: state.isStarred,
      },
    });

    return plainToInstance(
      FlashcardWithProgressDto,
      {
        id: flashcard.id,
        term: flashcard.term,
        definition: flashcard.definition,
        status: confidenceToStatus(saved),
        isStarred: saved.isStarred,
      },
      { excludeExtraneousValues: true },
    );
  }

  async updateStatus(
    userId: string,
    flashcardId: string,
    success: boolean,
  ): Promise<FlashcardWithProgressDto> {
    this.logger.log(
      `Attempting to ${success ? 'upgrade' : 'decrease'} status of flashcard with ID: ${flashcardId}`,
    );

    const flashcard = await this.prisma.flashcard.findUnique({
      where: { id: flashcardId },
    });
    if (!flashcard) {
      this.logger.warn(
        `Flashcard with ID ${flashcardId} not found for status update.`,
      );
      throw new NotFoundException('Flashcard not found');
    }

    const studySet = await this.prisma.studySet.findUnique({
      where: { id: flashcard.studySetId },
    });

    if (!studySet) {
      this.logger.warn(`Study set for flashcard ID ${flashcardId} not found.`);
      throw new NotFoundException('Study set not found');
    }

    const isOwner = await this.isStudySetOwner(userId, studySet.id);
    const canAccess = await this.studySetService.canAccess(userId, studySet.id);
    if (!canAccess) {
      this.logger.warn(
        `User ${userId} attempted to update status of flashcard ${flashcardId} in private study set ${studySet.id}`,
      );
      throw new ForbiddenException('Study set is private');
    }

    if (!isOwner) {
      const inCollection = await this.prisma.favouriteStudySet.findUnique({
        where: {
          userId_studySetId: { userId, studySetId: studySet.id },
        },
      });

      if (!inCollection) {
        this.logger.warn(
          `User ${userId} attempted to update status of flashcard ${flashcardId} without having study set ${studySet.id} in collection`,
        );
        throw new ForbiddenException(
          'Add the study set to your collection first',
        );
      }
    } else {
      await this.ensureProgressRecords(userId, studySet.id);
    }

    let state = await this.prisma.flashcardUserState.findUnique({
      where: { userId_flashcardId: { userId, flashcardId } },
    });

    if (!state) {
      state = await this.prisma.flashcardUserState.create({
        data: {
          userId,
          flashcardId,
        },
      });
    }

    const currentStatus = confidenceToStatus(state);
    const newStatus = nextStatusAfterAnswer(currentStatus, success);

    if (newStatus !== currentStatus) {
      state.confidenceLevel = statusToConfidence(newStatus);
      const saved = await this.prisma.flashcardUserState.update({
        where: { id: state.id },
        data: { confidenceLevel: state.confidenceLevel },
      });
      this.logger.log(
        `Successfully ${success ? 'upgraded' : 'decreased'} status of flashcard with ID: ${flashcardId} to ${newStatus}`,
      );
      return plainToInstance(
        FlashcardWithProgressDto,
        {
          id: flashcard.id,
          term: flashcard.term,
          definition: flashcard.definition,
          status: confidenceToStatus(saved),
          isStarred: saved.isStarred,
        },
        { excludeExtraneousValues: true },
      );
    }

    return plainToInstance(
      FlashcardWithProgressDto,
      {
        id: flashcard.id,
        term: flashcard.term,
        definition: flashcard.definition,
        status: confidenceToStatus(state),
        isStarred: state.isStarred,
      },
      { excludeExtraneousValues: true },
    );
  }

  async getProgress(
    userId: string,
    flashcardId: string,
  ): Promise<FlashcardWithProgressDto> {
    const flashcard = await this.prisma.flashcard.findUnique({
      where: { id: flashcardId },
    });
    if (!flashcard) {
      throw new NotFoundException('Flashcard not found');
    }

    const studySet = await this.prisma.studySet.findUnique({
      where: { id: flashcard.studySetId },
    });

    if (!studySet) {
      throw new NotFoundException('Study set not found');
    }

    const isOwner = await this.isStudySetOwner(userId, studySet.id);
    const canAccess = await this.studySetService.canAccess(userId, studySet.id);
    if (!canAccess) {
      throw new ForbiddenException('Study set is private');
    }

    const progressRow = await this.prisma.flashcardUserState.findUnique({
      where: { userId_flashcardId: { userId, flashcardId } },
    });

    const isCollected =
      isOwner ||
      !!(await this.prisma.favouriteStudySet.findUnique({
        where: {
          userId_studySetId: { userId, studySetId: studySet.id },
        },
      }));

    if (isCollected && !progressRow) {
      await this.ensureProgressRecords(userId, studySet.id);
      return this.getProgress(userId, flashcardId);
    }

    return plainToInstance(
      FlashcardWithProgressDto,
      {
        id: flashcard.id,
        term: flashcard.term,
        definition: flashcard.definition,
        status: confidenceToStatus(progressRow ?? null),
        isStarred: progressRow?.isStarred ?? false,
      },
      { excludeExtraneousValues: true },
    );
  }

  private async ensureProgressRecords(userId: string, studySetId: string) {
    const cards = await this.prisma.flashcard.findMany({
      where: { studySetId },
    });
    if (!cards.length) return;

    const cardIds = cards.map((t) => t.id);
    const existing = await this.prisma.flashcardUserState.findMany({
      where: { userId, flashcardId: { in: cardIds } },
    });

    const existingMap = new Set(existing.map((e) => e.flashcardId));

    const toCreate = cards
      .filter((t) => !existingMap.has(t.id))
      .map((card) => ({
        userId,
        flashcardId: card.id,
      }));

    if (toCreate.length) {
      await this.prisma.flashcardUserState.createMany({ data: toCreate });
    }
  }

  private async isStudySetOwner(
    userId: string,
    studySetId: string,
  ): Promise<boolean> {
    const row = await this.prisma.studySet.findUnique({
      where: { id: studySetId },
      select: { ownerId: true },
    });
    return row?.ownerId === userId;
  }
}
