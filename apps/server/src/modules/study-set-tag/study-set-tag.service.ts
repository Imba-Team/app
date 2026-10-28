import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StudySetVisibility } from '@prisma/client';

import { Role } from 'src/common/decorators/roles.decorator';
import { IUser } from 'src/common/interfaces/user.interface';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SearchSyncService } from 'src/modules/search/search-sync.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';
import { TagService } from 'src/modules/tag/tag.service';

import { CreateStudySetTagDto } from './dto/create-study-set-tag.dto';

@Injectable()
export class StudySetTagService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
    private readonly searchSync: SearchSyncService,
    private readonly tagService: TagService,
  ) {
    this.logger.setContext(StudySetTagService.name);
  }

  async addTagToStudySet(user: IUser, dto: CreateStudySetTagDto) {
    const { studySetId, tagName } = dto;

    const studySet = await this.prisma.studySet.findUnique({
      where: { id: studySetId },
    });
    if (!studySet) {
      throw new NotFoundException('Study set not found');
    }

    // Check before creating anything, so a forbidden request can't add tags.
    await this.assertCanModifyStudySetTags(user, studySet.id, studySet.ownerId);
    const tag = await this.tagService.findOrCreateByName(tagName);

    const existing = await this.prisma.studySetTag.findUnique({
      where: {
        studySetId_tagId: {
          studySetId,
          tagId: tag.id,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Tag is already attached to this study set');
    }

    const created = await this.prisma.studySetTag.create({
      data: {
        studySetId,
        tagId: tag.id,
      },
    });
    await this.searchSync.enqueueSync(studySetId);
    return created;
  }

  async removeTagFromStudySet(user: IUser, studySetId: string, tagId: string) {
    const existing = await this.prisma.studySetTag.findUnique({
      where: {
        studySetId_tagId: {
          studySetId,
          tagId,
        },
      },
      include: {
        studySet: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Study set tag relation not found');
    }

    await this.assertCanModifyStudySetTags(
      user,
      studySetId,
      existing.studySet.ownerId,
    );

    await this.prisma.studySetTag.delete({
      where: {
        studySetId_tagId: {
          studySetId,
          tagId,
        },
      },
    });
    await this.searchSync.enqueueSync(studySetId);
  }

  async listTagsForStudySet(user: IUser, studySetId: string) {
    const studySet = await this.prisma.studySet.findUnique({
      where: { id: studySetId },
    });

    if (!studySet) {
      throw new NotFoundException('Study set not found');
    }

    if (user.role !== Role.ADMIN) {
      const canAccess = await this.studySetService.canAccess(
        user.id,
        studySet.id,
      );
      if (!canAccess) {
        throw new ForbiddenException('Study set is private');
      }
    }

    const links = await this.prisma.studySetTag.findMany({
      where: { studySetId },
      include: {
        tag: true,
      },
      orderBy: {
        tag: {
          name: 'asc',
        },
      },
    });

    return links.map((link) => link.tag);
  }

  async listStudySetsForTag(user: IUser, tagId: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    const where =
      user.role === Role.ADMIN
        ? { tags: { some: { tagId } } }
        : {
            tags: { some: { tagId } },
            OR: [
              { visibility: StudySetVisibility.PUBLIC },
              { ownerId: user.id },
            ],
          };

    return this.prisma.studySet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        visibility: true,
        ownerId: true,
      },
    });
  }

  // Write access: the owner and EDITOR collaborators (SRS FR-TAG-03);
  // admins can moderate any study set.
  private async assertCanModifyStudySetTags(
    user: IUser,
    studySetId: string,
    ownerId: string,
  ): Promise<void> {
    if (user.role === Role.ADMIN || user.id === ownerId) return;
    if (await this.studySetService.canEdit(user.id, studySetId)) return;
    throw new ForbiddenException(
      'You can only manage tags for study sets you own or edit',
    );
  }
}
