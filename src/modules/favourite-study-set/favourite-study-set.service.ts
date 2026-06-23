import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { StudySetVisibility } from '@prisma/client';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';

@Injectable()
export class FavouriteStudySetService {
  constructor(
    private readonly logger: LoggerService,
    private readonly studySetService: StudySetService,
    private readonly prisma: PrismaService,
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

    return this.prisma.favouriteStudySet.create({
      data: {
        userId: currentUserId,
        studySetId,
      },
    });
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

    await this.prisma.favouriteStudySet.deleteMany({
      where: {
        userId: currentUserId,
        studySetId,
      },
    });
  }
}
