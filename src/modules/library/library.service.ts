import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Prisma } from '@prisma/client';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';

import { LibraryItemDto } from './dto/library-item.dto';

type LibraryRawRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: string;
  language: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  isOwner: boolean;
  isFavourited: boolean;
};

@Injectable()
export class LibraryService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.setContext(LibraryService.name);
  }

  async getLibrary(currentUserId: string): Promise<LibraryItemDto[]> {
    this.logger.debug(`Loading library for user: ${currentUserId}`);

    const rows = await this.prisma.$queryRaw<LibraryRawRow[]>(Prisma.sql`
      SELECT
        s."id",
        s."slug",
        s."title",
        s."description",
        s."visibility",
        s."language",
        s."ownerId",
        s."createdAt",
        s."updatedAt",
        (s."ownerId" = ${currentUserId}) AS "isOwner",
        (f."id" IS NOT NULL) AS "isFavourited"
      FROM "study_set" s
      LEFT JOIN "favorite_study_set" f
        ON f."studySetId" = s."id"
       AND f."userId" = ${currentUserId}
      WHERE s."ownerId" = ${currentUserId}
         OR f."userId" = ${currentUserId}
      ORDER BY s."createdAt" DESC
    `);

    return rows.map((row) =>
      plainToInstance(
        LibraryItemDto,
        {
          ...row,
          isOwner: this.toBoolean(row.isOwner),
          isFavourited: this.toBoolean(row.isFavourited),
        },
        { excludeExtraneousValues: true },
      ),
    );
  }

  private toBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
  }
}
