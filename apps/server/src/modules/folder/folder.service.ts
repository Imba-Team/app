import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Folder, StudySetVisibility } from '@prisma/client';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';

import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

@Injectable()
export class FolderService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.setContext(FolderService.name);
  }

  async create(userId: string, dto: CreateFolderDto) {
    return this.prisma.folder.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.folder.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOneById(userId: string, folderId: string) {
    const folder = await this.findOwnedFolderOrFail(userId, folderId);

    const links = await this.prisma.folderStudySet.findMany({
      where: { folderId },
      include: {
        studySet: {
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            visibility: true,
            ownerId: true,
          },
        },
      },
      orderBy: {
        studySet: {
          createdAt: 'desc',
        },
      },
    });

    return {
      ...folder,
      studySets: links.map((link) => ({
        ...link.studySet,
        isPrivate: link.studySet.visibility === StudySetVisibility.PRIVATE,
      })),
    };
  }

  async update(userId: string, folderId: string, dto: UpdateFolderDto) {
    await this.findOwnedFolderOrFail(userId, folderId);

    return this.prisma.folder.update({
      where: { id: folderId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
    });
  }

  async delete(userId: string, folderId: string) {
    await this.findOwnedFolderOrFail(userId, folderId);

    await this.prisma.$transaction([
      this.prisma.folderStudySet.deleteMany({ where: { folderId } }),
      this.prisma.folder.delete({ where: { id: folderId } }),
    ]);
  }

  async findOwnedFolderOrFail(
    userId: string,
    folderId: string,
  ): Promise<Folder> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.userId !== userId) {
      throw new ForbiddenException('You cannot access this folder');
    }

    return folder;
  }
}
