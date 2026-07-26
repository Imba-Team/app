/**
 * Handles study set CRUD, collection membership, and user progress shaping.
 */

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CollaboratorRole,
  Prisma,
  StudySet,
  StudySetVisibility,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';

// Entities and enums
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { slugify } from 'src/common/utils/sligify';
import { SearchSyncService } from 'src/modules/search/search-sync.service';
import { UsersService } from 'src/modules/users/user.service';

// DTOs
import { CreateStudySetDto } from './dtos/create-study-set.dto';
import {
  PublicSetSort,
  SearchStudySetsDto,
} from './dtos/search-study-sets.dto';
import {
  RecentStudySetDto,
  StudySetProgressDto,
} from './dtos/recent-study-set.dto';
import { StudySetResponseDto } from './dtos/study-set-response.dto';
import { UpdateStudySetDto } from './dtos/update-study-set.dto';
import { UpdateVisibilityDto } from './dtos/update-visibility.dto';

type FlashcardLite = { orderIndex: number };
type StudySetWithFlashcards = StudySet & { flashcards?: FlashcardLite[] };
type OwnerProjection = {
  id: string;
  username: string | null;
  profilePicture: string | null;
};

@Injectable()
export class StudySetService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly searchSync: SearchSyncService,
  ) {
    this.logger.setContext(StudySetService.name);
  }

  // Section: Study set lifecycle operations

  async create(userId: string, dto: CreateStudySetDto) {
    this.logger.debug(`Creating study set for user: ${userId}`);

    //Check the user existence
    await this.usersService.findById(userId);

    const slug = slugify(dto.title);
    const duplicate = await this.prisma.studySet.findFirst({
      where: {
        OR: [{ slug }, { title: dto.title }],
      },
    });

    // If a duplicate exists, determine if it's a slug or title conflict for better logging and error messages
    if (duplicate) {
      if (duplicate.slug === slug) {
        this.logger.warn(
          `Duplicate study set slug attempt: slug=${slug}, userId=${userId}`,
        );
        throw new ConflictException('Study set slug already exists');
      }
      this.logger.warn(
        `Duplicate study set title attempt: title="${dto.title}", userId=${userId}`,
      );
      throw new ConflictException('Study set title already exists');
    }

    const saved = await this.prisma.studySet.create({
      data: {
        slug,
        title: dto.title,
        description: dto.description,
        language: dto.language,
        visibility:
          dto.isPrivate === true
            ? StudySetVisibility.PRIVATE
            : StudySetVisibility.PUBLIC,
        ownerId: userId,
      },
    });

    this.logger.log(`Study set created: id=${saved.id}, userId=${userId}`);

    await this.searchSync.enqueueIndex(saved.id);

    return this.buildStudySetForUser(saved.id, userId);
  }

  async update(userId: string, studySetId: string, dto: UpdateStudySetDto) {
    this.logger.debug(`Updating study set: id=${studySetId}, userId=${userId}`);
    await this.ensureOwnedStudySet(userId, studySetId);
    const patch: Prisma.StudySetUpdateInput = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.language !== undefined) patch.language = dto.language;
    if (dto.isPrivate !== undefined) {
      patch.visibility = dto.isPrivate
        ? StudySetVisibility.PRIVATE
        : StudySetVisibility.PUBLIC;
    }
    if (Object.keys(patch).length) {
      await this.prisma.studySet.update({
        where: { id: studySetId },
        data: patch,
      });
      this.logger.log(`Study set updated: id=${studySetId}, userId=${userId}`);
      await this.searchSync.enqueueIndex(studySetId);
    }
    return this.buildStudySetForUser(studySetId, userId);
  }

  async updateVisibility(
    userId: string,
    studySetId: string,
    visibilityDto: UpdateVisibilityDto,
  ) {
    this.logger.debug(
      `Updating study set visibility: id=${studySetId}, userId=${userId}`,
    );
    await this.ensureOwnedStudySet(userId, studySetId);
    await this.prisma.studySet.update({
      where: { id: studySetId },
      data: {
        visibility: visibilityDto.isPrivate
          ? StudySetVisibility.PRIVATE
          : StudySetVisibility.PUBLIC,
      },
    });
    this.logger.log(
      `Study set visibility updated: id=${studySetId}, private=${visibilityDto.isPrivate}`,
    );

    // Going private removes the doc from the index; going public re-adds it.
    if (visibilityDto.isPrivate) {
      await this.searchSync.enqueueDelete(studySetId);
    } else {
      await this.searchSync.enqueueIndex(studySetId);
    }

    return this.buildStudySetForUser(studySetId, userId);
  }

  // Section: Study set listing and discovery

  async findCreatedStudySets(userId: string) {
    this.logger.debug(`Listing created study sets for user: ${userId}`);
    const sets = await this.prisma.studySet.findMany({
      where: { ownerId: userId },
      include: { flashcards: true },
      orderBy: { updatedAt: 'desc' },
    });
    const sorted = sets.map((s) => this.withSortedFlashcards(s));
    return this.buildStudySetsForUserBatch(sorted, userId);
  }

  async findCollection(userId: string, q?: string) {
    this.logger.debug(
      `Listing collection study sets for user: ${userId}, q="${q ?? ''}"`,
    );
    // Text filter is applied at the SQL layer so we don't have to hydrate
    // rows that will be immediately discarded. Owner-side and favourite-
    // side each get the same OR block.
    const queryTrimmed = q?.trim();
    const textFilter = queryTrimmed
      ? {
          OR: [
            {
              title: { contains: queryTrimmed, mode: 'insensitive' as const },
            },
            {
              description: {
                contains: queryTrimmed,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : undefined;

    const owned = await this.prisma.studySet.findMany({
      where: { ownerId: userId, ...textFilter },
      include: { flashcards: true },
    });
    const favLinks = await this.prisma.favouriteStudySet.findMany({
      where: { userId, studySet: textFilter },
      include: { studySet: { include: { flashcards: true } } },
    });

    const byId = new Map<string, StudySetWithFlashcards>();
    for (const s of owned) {
      byId.set(s.id, this.withSortedFlashcards(s));
    }
    for (const link of favLinks) {
      if (link.studySet && !byId.has(link.studySet.id)) {
        byId.set(link.studySet.id, this.withSortedFlashcards(link.studySet));
      }
    }

    const all = [...byId.values()].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
    return this.buildStudySetsForUserBatch(all, userId);
  }

  async delete(userId: string, studySetId: string): Promise<void> {
    this.logger.debug(`Deleting study set: id=${studySetId}, userId=${userId}`);
    await this.ensureOwnedStudySet(userId, studySetId);

    // Most children reference StudySet or Flashcard with onDelete: Restrict.
    // Delete them explicitly in dependency order inside one transaction:
    //   TestQuestionAttempt -> TestAttempt          (both Restrict)
    //   StudySession, Comment, Collaborator, Fav,
    //   FolderStudySet, StudySetTag                 (all Restrict on set)
    //   Flashcard                                    (Restrict on set; cascades
    //     UserCardProgress + SrsCard on flashcard delete)
    //   StudySet                                     (cascades UserSetProgress)
    // Any of these left dangling would raise a FK violation on the final
    // delete and surface as a 500 to the caller — which is what triggered
    // this fix.
    await this.prisma.$transaction([
      this.prisma.testQuestionAttempt.deleteMany({
        where: { testAttempt: { studySetId } },
      }),
      this.prisma.testAttempt.deleteMany({ where: { studySetId } }),
      this.prisma.studySession.deleteMany({ where: { studySetId } }),
      this.prisma.comment.deleteMany({ where: { studySetId } }),
      this.prisma.studySetCollaborator.deleteMany({ where: { studySetId } }),
      this.prisma.favouriteStudySet.deleteMany({ where: { studySetId } }),
      this.prisma.folderStudySet.deleteMany({ where: { studySetId } }),
      this.prisma.studySetTag.deleteMany({ where: { studySetId } }),
      this.prisma.flashcard.deleteMany({ where: { studySetId } }),
      this.prisma.studySet.delete({ where: { id: studySetId } }),
    ]);

    await this.searchSync.enqueueDelete(studySetId);
    this.logger.log(`Study set deleted: id=${studySetId}, userId=${userId}`);
  }

  async searchPublic(userId: string, query: SearchStudySetsDto) {
    this.logger.debug(
      `Searching public study sets for user: ${userId}, ` +
        `query="${query.q ?? ''}", sort=${query.sort ?? PublicSetSort.RECENT}`,
    );
    const where: Prisma.StudySetWhereInput = {
      visibility: StudySetVisibility.PUBLIC,
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // `sort=popular` powers the dashboard Discover strip. Default stays
    // `recent` (updatedAt desc) so existing callers of /study-sets/public
    // — which never sent a `sort` — see no behavior change.
    const orderBy: Prisma.StudySetOrderByWithRelationInput =
      query.sort === PublicSetSort.POPULAR
        ? { viewCount: 'desc' }
        : { updatedAt: 'desc' };

    const sets = await this.prisma.studySet.findMany({
      where,
      include: {
        flashcards: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy,
    });

    const sorted = sets.map((s) => this.withSortedFlashcards(s));
    return this.buildStudySetsForUserBatch(sorted, userId);
  }

  /**
   * Sets the caller has actually opened a session for, most-recent first.
   * Powers the dashboard "Continue studying" strip; if the user has
   * never studied anything, returns []. Owned/favourited-but-untouched
   * sets are intentionally excluded — those belong in /library, not in
   * a "continue" surface.
   */
  async findRecent(
    userId: string,
    limit: number,
  ): Promise<RecentStudySetDto[]> {
    this.logger.debug(
      `Listing recently-studied sets for user: ${userId}, limit=${limit}`,
    );

    const progressRows = await this.prisma.userSetProgress.findMany({
      where: {
        userId,
        lastStudiedAt: { not: null },
      },
      orderBy: { lastStudiedAt: 'desc' },
      take: limit,
    });

    if (progressRows.length === 0) return [];

    const setIds = progressRows.map((r) => r.setId);
    const sets = await this.prisma.studySet.findMany({
      where: { id: { in: setIds } },
      include: { flashcards: true },
    });

    // Preserve the lastStudiedAt ordering — findMany({ in }) doesn't
    // honour input order. Hydrate to StudySetResponseDto first, then
    // attach the progress payload we already have on hand.
    const setById = new Map(sets.map((s) => [s.id, this.withSortedFlashcards(s)]));
    const base = await this.buildStudySetsForUserBatch(
      progressRows
        .map((r) => setById.get(r.setId))
        .filter((s): s is StudySetWithFlashcards => Boolean(s)),
      userId,
    );

    const progressById = new Map(progressRows.map((r) => [r.setId, r]));
    return base.map((set) => {
      const p = progressById.get(set.id);
      const progressDto = p
        ? plainToInstance(
            StudySetProgressDto,
            {
              totalCards: p.totalCards,
              newCount: p.newCount,
              learningCount: p.learningCount,
              masteredCount: p.masteredCount,
            },
            { excludeExtraneousValues: true },
          )
        : null;

      return plainToInstance(
        RecentStudySetDto,
        {
          ...set,
          lastStudiedAt: p?.lastStudiedAt ?? null,
          progress: progressDto,
        },
        { excludeExtraneousValues: true },
      );
    });
  }

  // Section: Single study set retrieval

  async getById(userId: string, studySetId: string) {
    this.logger.debug(
      `Getting study set by id: studySetId=${studySetId}, userId=${userId}`,
    );
    const studySet = await this.prisma.studySet.findUnique({
      where: { id: studySetId },
      include: { flashcards: true },
    });

    if (!studySet) {
      throw new NotFoundException('Study set not found');
    }

    await this.ensureCanAccess(userId, studySet.id);

    const sorted = this.withSortedFlashcards(studySet);
    const isOwner = sorted.ownerId === userId;
    const isCollected =
      isOwner ||
      !!(await this.prisma.favouriteStudySet.findUnique({
        where: {
          userId_studySetId: { userId, studySetId },
        },
      }));

    // Only count non-owner views — otherwise the owner refreshing their
    // own set inflates the popularity metric. Fire-and-forget: a failed
    // increment must not fail the read.
    if (!isOwner) {
      this.prisma.studySet
        .update({
          where: { id: studySetId },
          data: { viewCount: { increment: 1 } },
        })
        .catch((err: unknown) => {
          this.logger.warn(
            `viewCount increment failed for studySetId=${studySetId}: ${(err as Error).message}`,
          );
        });
    }

    return this.buildStudySetForUser(sorted, userId, isCollected);
  }

  async findByIdOrFail(studySetId: string): Promise<StudySet> {
    return this.findStudySetOrFail(studySetId);
  }

  // Section: Mapping helpers

  private withSortedFlashcards(
    studySet: StudySetWithFlashcards,
  ): StudySetWithFlashcards {
    if (studySet.flashcards?.length) {
      studySet.flashcards.sort((a, b) => a.orderIndex - b.orderIndex);
    }
    return studySet;
  }

  private async buildStudySetForUser(
    studySetOrId: StudySetWithFlashcards | string,
    userId: string,
    alreadyCollected?: boolean,
  ): Promise<StudySetResponseDto> {
    const studySet =
      typeof studySetOrId === 'string'
        ? await this.prisma.studySet.findUnique({
            where: { id: studySetOrId },
            include: { flashcards: true },
          })
        : studySetOrId;

    if (!studySet) {
      throw new NotFoundException('Study set not found');
    }

    this.withSortedFlashcards(studySet);

    const ownerUserId = studySet.ownerId;
    const isOwner = ownerUserId === userId;
    const isCollected =
      alreadyCollected ??
      (isOwner ||
        !!(await this.prisma.favouriteStudySet.findUnique({
          where: {
            userId_studySetId: { userId, studySetId: studySet.id },
          },
        })));
    const flashcards = studySet.flashcards || [];

    const owner = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        id: true,
        username: true,
        profilePicture: true,
      },
    });

    return plainToInstance(
      StudySetResponseDto,
      {
        id: studySet.id,
        slug: studySet.slug,
        title: studySet.title,
        description: studySet.description ?? '',
        isPrivate: studySet.visibility === StudySetVisibility.PRIVATE,
        ownerId: ownerUserId,
        ownerName: owner?.username ?? undefined,
        ownerImg: owner?.profilePicture,
        isOwner,
        isCollected,
        flashcardsCount: flashcards.length,
        createdAt: studySet.createdAt,
        updatedAt: studySet.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  private async ensureOwnedStudySet(userId: string, studySetId: string) {
    const studySet = await this.findStudySetOrFail(studySetId);
    if (studySet.ownerId !== userId) {
      this.logger.warn(
        `Forbidden update attempt on non-owned study set: studySetId=${studySetId}, userId=${userId}`,
      );
      throw new ForbiddenException('You can only modify your own study sets');
    }
    return studySet;
  }

  async canAccess(userId: string, studySetId: string): Promise<boolean> {
    const studySet = await this.findStudySetOrFail(studySetId);

    if (studySet.visibility === StudySetVisibility.PUBLIC) return true;
    if (studySet.visibility === StudySetVisibility.UNLISTED) return true;
    if (studySet.ownerId === userId) return true;

    const collaborator = await this.prisma.studySetCollaborator.findUnique({
      where: {
        userId_studySetId: {
          userId,
          studySetId,
        },
      },
      select: { id: true },
    });

    return !!collaborator;
  }

  async canEdit(userId: string, studySetId: string): Promise<boolean> {
    const studySet = await this.findStudySetOrFail(studySetId);

    if (studySet.ownerId === userId) {
      return true;
    }

    if (studySet.visibility !== StudySetVisibility.PRIVATE) {
      return false;
    }

    const collaborator = await this.prisma.studySetCollaborator.findUnique({
      where: {
        userId_studySetId: {
          userId,
          studySetId,
        },
      },
      select: { role: true },
    });

    return collaborator?.role === CollaboratorRole.EDITOR;
  }

  private async ensureCanAccess(userId: string, studySetId: string) {
    const allowed = await this.canAccess(userId, studySetId);
    if (allowed) return;

    this.logger.warn(
      `Study set access denied: studySetId=${studySetId}, userId=${userId}`,
    );
    throw new ForbiddenException('You do not have access to this study set');
  }

  private async findStudySetOrFail(studySetId: string): Promise<StudySet> {
    const studySet = await this.prisma.studySet.findUnique({
      where: { id: studySetId },
    });
    if (!studySet) {
      this.logger.warn(`Study set not found: studySetId=${studySetId}`);
      throw new NotFoundException('Study set not found');
    }
    return studySet;
  }

  // Section: Batch response builders

  private async buildStudySetsForUserBatch(
    studySets: StudySetWithFlashcards[],
    userId: string,
  ): Promise<StudySetResponseDto[]> {
    if (!studySets.length) return [];

    const studySetIds = studySets.map((m) => m.id);
    const ownerIds = [...new Set(studySets.map((m) => m.ownerId))];

    const [ownerUsers, favoriteLinks] = await Promise.all([
      ownerIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: ownerIds } },
            select: {
              id: true,
              username: true,
              profilePicture: true,
            },
          })
        : Promise.resolve([] as OwnerProjection[]),
      this.prisma.favouriteStudySet.findMany({
        where: { userId, studySetId: { in: studySetIds } },
      }),
    ]);

    const ownerMap = new Map(ownerUsers.map((o) => [o.id, o]));
    const favoritedIds = new Set(favoriteLinks.map((f) => f.studySetId));

    return Promise.all(
      studySets.map((studySet) => {
        this.withSortedFlashcards(studySet);
        const ownerUserId = studySet.ownerId;
        const isOwner = ownerUserId === userId;
        const isCollected = isOwner || favoritedIds.has(studySet.id);
        const flashcards = studySet.flashcards || [];
        const owner = ownerMap.get(ownerUserId);

        return plainToInstance(
          StudySetResponseDto,
          {
            id: studySet.id,
            slug: studySet.slug,
            title: studySet.title,
            description: studySet.description ?? '',
            isPrivate: studySet.visibility === StudySetVisibility.PRIVATE,
            ownerId: ownerUserId,
            ownerName: owner?.username ?? undefined,
            ownerImg: owner?.profilePicture,
            isOwner,
            isCollected,
            flashcardsCount: flashcards.length,
            createdAt: studySet.createdAt,
            updatedAt: studySet.updatedAt,
          },
          { excludeExtraneousValues: true },
        );
      }),
    );
  }
}
