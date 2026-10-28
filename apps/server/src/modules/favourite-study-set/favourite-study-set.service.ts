import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { StudySetVisibility } from '@prisma/client';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SearchSyncService } from 'src/modules/search/search-sync.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';

@Injectable()
export class FavouriteStudySetService {
  constructor(
    private readonly logger: LoggerService,
    private readonly studySetService: StudySetService,
    private readonly prisma: PrismaService,
    private readonly searchSync: SearchSyncService,
  ) {
    this.logger.setContext(FavouriteStudySetService.name);
  }

  async addToLibrary(currentUserId: string, studySetId: string) {
    const studySet = await this.studySetService.findByIdOrFail(studySetId);

    if (studySet.ownerId === currentUserId) {
      throw new BadRequestException(
        'You cannot save your own study set to your library',
      );
    }

    if (studySet.visibility !== StudySetVisibility.PUBLIC) {
      throw new ForbiddenException('Only public study sets can be saved');
    }

    const existing = await this.prisma.favouriteStudySet.findUnique({
      where: {
        userId_studySetId: {
          userId: currentUserId,
          studySetId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Study set is already saved in your library');
    }

    await this.prisma.favouriteStudySet.create({
      data: {
        userId: currentUserId,
        studySetId,
      },
    });

    this.logger.log(
      `Study set saved to library: studySetId=${studySetId}, userId=${currentUserId}`,
    );
    // likeCount ("saves") in the search document.
    await this.searchSync.enqueueSync(studySetId);

    return this.studySetService.getById(currentUserId, studySetId);
  }

  async removeFromLibrary(
    currentUserId: string,
    studySetId: string,
  ): Promise<void> {
    const studySet = await this.studySetService.findByIdOrFail(studySetId);

    if (studySet.ownerId === currentUserId) {
      throw new ForbiddenException(
        'You cannot unsave your own study set from library',
      );
    }

    const { count } = await this.prisma.favouriteStudySet.deleteMany({
      where: {
        userId: currentUserId,
        studySetId,
      },
    });
    if (count > 0) await this.searchSync.enqueueSync(studySetId);

    this.logger.log(
      `Study set removed from library: studySetId=${studySetId}, userId=${currentUserId}`,
    );
  }
}
