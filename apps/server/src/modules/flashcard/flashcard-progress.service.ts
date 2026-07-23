import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CardMasteryStatus, Prisma } from '@prisma/client';
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

  /**
   * Bulk cards+progress for a set — one row per flashcard, folded with the
   * caller's UserCardProgress (or defaults if they have never touched it).
   * Powers the module page's term list so the mastery dot reflects reality
   * without N per-card requests.
   *
   * `filter.starred`/`filter.status` narrow the set at the SQL layer so
   * callers (flashcard mode with an "only starred" toggle, module page
   * with a mastery filter) don't need to pull every card just to throw
   * most of them away in JS.
   *
   * A subtle behaviour: `status = NEW` includes cards that have no
   * UserCardProgress row yet (they're implicitly NEW). This is why the
   * query walks flashcards first and joins optional progress, rather
   * than the other way round.
   */
  async listWithProgress(
    userId: string,
    studySetId: string,
    filter: { starred?: boolean; status?: CardMasteryStatus; q?: string } = {},
  ): Promise<FlashcardWithProgressDto[]> {
    const canAccess = await this.studySetService.canAccess(userId, studySetId);
    if (!canAccess) throw new ForbiddenException('Study set is private');

    // Any non-NEW filter or `starred` filter guarantees a UserCardProgress
    // row must exist, so we narrow the flashcard query by requiring an
    // eligible progress row per (userId, cardId).
    const progressRowConstraint: {
      isStarred?: boolean;
      status?: CardMasteryStatus;
    } = {};
    if (filter.starred !== undefined) {
      progressRowConstraint.isStarred = filter.starred;
    }
    if (filter.status !== undefined && filter.status !== CardMasteryStatus.NEW) {
      progressRowConstraint.status = filter.status;
    }

    const requireProgressRow = Object.keys(progressRowConstraint).length > 0;
    // Special-case: status=NEW means "no progress row OR row with status=NEW".
    const wantNewOnly = filter.status === CardMasteryStatus.NEW;

    // Text search on term/definition. Applied as an AND against the
    // mastery/starred filter so a search inside the "Learning" pill
    // narrows within that bucket instead of resetting it.
    const q = filter.q?.trim();
    const textFilter = q
      ? {
          OR: [
            { term: { contains: q, mode: 'insensitive' as const } },
            { definition: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const flashcardWhere: {
      studySetId: string;
      cardProgress?: {
        some?: { userId: string } & typeof progressRowConstraint;
        none?: { userId: string };
      };
      AND?: Array<{
        OR: Array<{
          term?: { contains: string; mode: 'insensitive' };
          definition?: { contains: string; mode: 'insensitive' };
        }>;
      }>;
      OR?: Array<{
        cardProgress:
          | { some: { userId: string; status: CardMasteryStatus } }
          | { none: { userId: string } };
      }>;
    } = { studySetId };

    if (wantNewOnly && filter.starred === undefined) {
      // NEW = never studied OR studied but still in NEW bucket. Wrap
      // in `OR` at the top level; the text filter goes inside `AND`
      // so it composes cleanly with the mastery OR-branch.
      flashcardWhere.OR = [
        {
          cardProgress: {
            some: { userId, status: CardMasteryStatus.NEW },
          },
        },
        { cardProgress: { none: { userId } } },
      ];
    } else if (requireProgressRow) {
      flashcardWhere.cardProgress = {
        some: { userId, ...progressRowConstraint },
      };
    }

    if (textFilter) {
      flashcardWhere.AND = [textFilter];
    }

    const flashcards = await this.prisma.flashcard.findMany({
      // Cast our locally-typed shape to the generated Prisma input —
      // structurally identical, but the generated type wraps things in
      // additional utility unions we don't need to spell out.
      where: flashcardWhere as Prisma.FlashcardWhereInput,
      orderBy: { orderIndex: 'asc' },
    });

    if (flashcards.length === 0) return [];

    const progressRows = await this.prisma.userCardProgress.findMany({
      where: {
        userId,
        cardId: { in: flashcards.map((fc) => fc.id) },
      },
    });
    const progressByCard = new Map(progressRows.map((p) => [p.cardId, p]));

    return flashcards.map((fc) => {
      const p = progressByCard.get(fc.id);
      return plainToInstance(
        FlashcardWithProgressDto,
        {
          id: fc.id,
          term: fc.term,
          definition: fc.definition,
          status: p?.status ?? CardMasteryStatus.NEW,
          weightedStreak: p?.weightedStreak.toString() ?? '0.00',
          isStarred: p?.isStarred ?? false,
          masteredAt: p?.masteredAt ?? null,
        },
        { excludeExtraneousValues: true },
      );
    });
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
