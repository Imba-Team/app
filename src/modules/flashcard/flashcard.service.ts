import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';

import { CreateFlashcardDto } from './dtos/create-flashcard.dto';
import { FlashcardResponseDto } from './dtos/flashcard-response.dto';
import { UpdateFlashcardDto } from './dtos/update-flashcard.dto';

@Injectable()
export class FlashcardService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
  ) {
    this.logger.setContext(FlashcardService.name);
  }

  async create(
    userId: string,
    studySetId: string,
    dto: CreateFlashcardDto,
  ): Promise<FlashcardResponseDto> {
    await this.ensureCanEdit(userId, studySetId);

    const orderIndex =
      dto.orderIndex ?? (await this.nextOrderIndex(studySetId));

    const saved = await this.prisma.flashcard.create({
      data: {
        studySetId,
        term: dto.term,
        definition: dto.definition,
        example: dto.example,
        phonetic: dto.phonetic,
        hint: dto.hint,
        imageUrl: dto.imageUrl,
        orderIndex,
      },
    });

    this.logger.log(
      `Flashcard created: id=${saved.id}, studySetId=${studySetId}`,
    );
    return this.toResponse(saved);
  }

  async list(
    userId: string,
    studySetId: string,
  ): Promise<FlashcardResponseDto[]> {
    const allowed = await this.studySetService.canAccess(userId, studySetId);
    if (!allowed) {
      throw new ForbiddenException('You do not have access to this study set');
    }

    const cards = await this.prisma.flashcard.findMany({
      where: { studySetId },
      orderBy: { orderIndex: 'asc' },
    });

    return cards.map((c) => this.toResponse(c));
  }

  async update(
    userId: string,
    flashcardId: string,
    dto: UpdateFlashcardDto,
  ): Promise<FlashcardResponseDto> {
    const flashcard = await this.findFlashcardOrFail(flashcardId);
    await this.ensureCanEdit(userId, flashcard.studySetId);

    const patch: Prisma.FlashcardUpdateInput = {};
    if (dto.term !== undefined) patch.term = dto.term;
    if (dto.definition !== undefined) patch.definition = dto.definition;
    if (dto.example !== undefined) patch.example = dto.example;
    if (dto.phonetic !== undefined) patch.phonetic = dto.phonetic;
    if (dto.hint !== undefined) patch.hint = dto.hint;
    if (dto.imageUrl !== undefined) patch.imageUrl = dto.imageUrl;
    if (dto.orderIndex !== undefined) patch.orderIndex = dto.orderIndex;

    if (!Object.keys(patch).length) {
      return this.toResponse(flashcard);
    }

    const saved = await this.prisma.flashcard.update({
      where: { id: flashcardId },
      data: patch,
    });

    this.logger.log(`Flashcard updated: id=${flashcardId}`);
    return this.toResponse(saved);
  }

  async delete(userId: string, flashcardId: string): Promise<void> {
    const flashcard = await this.findFlashcardOrFail(flashcardId);
    await this.ensureCanEdit(userId, flashcard.studySetId);

    // Per-user progress rows reference the card with onDelete: Restrict, so clear
    // them first to keep the API contract simple: removing a card removes its
    // progress trail.
    await this.prisma.flashcardUserState.deleteMany({
      where: { flashcardId },
    });
    await this.prisma.flashcard.delete({ where: { id: flashcardId } });

    this.logger.log(`Flashcard deleted: id=${flashcardId}`);
  }

  private async ensureCanEdit(userId: string, studySetId: string) {
    const allowed = await this.studySetService.canEdit(userId, studySetId);
    if (!allowed) {
      this.logger.warn(
        `Flashcard edit denied: studySetId=${studySetId}, userId=${userId}`,
      );
      throw new ForbiddenException(
        'You can only modify cards in your own study sets',
      );
    }
  }

  private async nextOrderIndex(studySetId: string): Promise<number> {
    const last = await this.prisma.flashcard.findFirst({
      where: { studySetId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return last ? last.orderIndex + 1 : 0;
  }

  private async findFlashcardOrFail(flashcardId: string) {
    const flashcard = await this.prisma.flashcard.findUnique({
      where: { id: flashcardId },
    });
    if (!flashcard) {
      throw new NotFoundException('Flashcard not found');
    }
    return flashcard;
  }

  private toResponse(flashcard: {
    id: string;
    studySetId: string;
    term: string;
    definition: string;
    example: string | null;
    phonetic: string | null;
    hint: string | null;
    imageUrl: string | null;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
  }): FlashcardResponseDto {
    return plainToInstance(FlashcardResponseDto, flashcard, {
      excludeExtraneousValues: true,
    });
  }
}
