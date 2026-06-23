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
import { UsersService } from 'src/modules/users/user.service';

// DTOs
import { CreateStudySetDto } from './dtos/create-study-set.dto';
import { SearchStudySetsDto } from './dtos/search-study-sets.dto';
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

    return this.buildStudySetForUser(studySetId, userId);
  }

  // Section: Study set listing and discovery

  async findCreatedStudySets(userId: string) {
    this.logger.debug(`Listing created study sets for user: ${userId}`);
    const sets = await this.prisma.studySet.findMany({
      where: { ownerId: userId },
      include: { flashcards: true },
    });
    const sorted = sets.map((s) => this.withSortedFlashcards(s));
    return this.buildStudySetsForUserBatch(sorted, userId);
  }

  async findCollection(userId: string) {
    this.logger.debug(`Listing collection study sets for user: ${userId}`);
    const owned = await this.prisma.studySet.findMany({
      where: { ownerId: userId },
      include: { flashcards: true },
    });
    const favLinks = await this.prisma.favouriteStudySet.findMany({
      where: { userId },
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

    return this.buildStudySetsForUserBatch([...byId.values()], userId);
  }

  async searchPublic(userId: string, query: SearchStudySetsDto) {
    this.logger.debug(
      `Searching public study sets for user: ${userId}, query="${query.q ?? ''}"`,
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

    const sets = await this.prisma.studySet.findMany({
      where,
      include: {
        flashcards: { orderBy: { orderIndex: 'asc' } },
      },
    });

    const sorted = sets.map((s) => this.withSortedFlashcards(s));
    return this.buildStudySetsForUserBatch(sorted, userId);
  }

  // Section: Collection membership operations

  async addToCollection(userId: string, studySetId: string) {
    this.logger.debug(
      `Adding study set to collection: studySetId=${studySetId}, userId=${userId}`,
    );
    const studySet = await this.findStudySetOrFail(studySetId);
    await this.ensureCanAccess(userId, studySet.id);

    if (studySet.ownerId !== userId) {
      const exists = await this.prisma.favouriteStudySet.findUnique({
        where: {
          userId_studySetId: { userId, studySetId },
        },
      });
      if (!exists) {
        await this.prisma.favouriteStudySet.create({
          data: { userId, studySetId },
        });
        this.logger.log(
          `Study set collected: studySetId=${studySetId}, userId=${userId}`,
        );
      }
    }
    return this.buildStudySetForUser(studySetId, userId);
  }

  async removeFromCollection(userId: string, studySetId: string) {
    this.logger.debug(
      `Removing study set from collection: studySetId=${studySetId}, userId=${userId}`,
    );
    const studySet = await this.findStudySetOrFail(studySetId);
    await this.ensureCanAccess(userId, studySet.id);

    if (studySet.ownerId === userId) {
      this.logger.warn(
        `Owner attempted to uncollect own study set: studySetId=${studySetId}, userId=${userId}`,
      );
      throw new ForbiddenException(
        'Cannot remove your own study set from collection',
      );
    }

    await this.prisma.favouriteStudySet.deleteMany({
      where: { userId, studySetId },
    });
    this.logger.log(
      `Study set uncollected: studySetId=${studySetId}, userId=${userId}`,
    );

    return this.buildStudySetForUser(studySetId, userId, false);
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
          },
          { excludeExtraneousValues: true },
        );
      }),
    );
  }
}
