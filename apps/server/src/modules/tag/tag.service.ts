import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StudySetVisibility, Tag } from '@prisma/client';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { slugify } from 'src/common/utils/sligify';
import { SearchSyncService } from 'src/modules/search/search-sync.service';

import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly searchSync: SearchSyncService,
  ) {
    this.logger.setContext(TagService.name);
  }

  async create(dto: CreateTagDto): Promise<Tag> {
    const slug = slugify(dto.name);

    const duplicate = await this.prisma.tag.findFirst({
      where: {
        OR: [{ name: dto.name }, { slug }],
      },
    });

    if (duplicate) {
      if (duplicate.slug === slug) {
        throw new ConflictException('Tag slug already exists');
      }

      throw new ConflictException('Tag name already exists');
    }

    return this.prisma.tag.create({
      data: {
        name: dto.name,
        slug,
      },
    });
  }

  /**
   * The tag called `rawName` (matched by name or slug, so "Biology" and
   * "biology" are one tag), created on first use. Two users creating the
   * same new tag at once is handled: the loser's unique-constraint error
   * becomes a re-read.
   */
  async findOrCreateByName(rawName: string): Promise<Tag> {
    const name = rawName.trim();
    const slug = slugify(name);
    const find = () =>
      this.prisma.tag.findFirst({ where: { OR: [{ slug }, { name }] } });

    const existing = await find();
    if (existing) return existing;

    try {
      return await this.prisma.tag.create({ data: { name, slug } });
    } catch (error) {
      const isRace =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';
      const winner = isRace ? await find() : null;
      if (!winner) throw error;
      return winner;
    }
  }

  /**
   * Resolve tag names to Tag rows, creating missing ones. Names are
   * trimmed and de-duplicated by slug, keeping the first spelling.
   */
  async findOrCreateMany(names: string[]): Promise<Tag[]> {
    const bySlug = new Map<string, string>();
    for (const raw of names) {
      const name = raw.trim();
      const slug = slugify(name);
      if (slug && !bySlug.has(slug)) bySlug.set(slug, name);
    }
    const tags: Tag[] = [];
    // Sequential so names that slugify alike can't race each other.
    for (const name of bySlug.values()) {
      tags.push(await this.findOrCreateByName(name));
    }
    return tags;
  }

  /**
   * Make `tagIds` the set's exact tag list. Runs inside the caller's
   * transaction so it lands together with the set's other changes.
   */
  async replaceStudySetTags(
    tx: Prisma.TransactionClient,
    studySetId: string,
    tagIds: string[],
  ): Promise<void> {
    await tx.studySetTag.deleteMany({
      where: { studySetId, tagId: { notIn: tagIds } },
    });
    if (tagIds.length) {
      await tx.studySetTag.createMany({
        data: tagIds.map((tagId) => ({ studySetId, tagId })),
        skipDuplicates: true,
      });
    }
  }

  /**
   * Tag suggestions for the tag input (MIM-37), most-used first. Only
   * tags the user could already see are suggested: ones on a public set
   * or on one of the user's own sets — private sets' tags don't leak.
   */
  async suggest(
    userId: string,
    q: string | undefined,
    limit: number,
  ): Promise<Pick<Tag, 'id' | 'name' | 'slug'>[]> {
    const query = q?.trim();
    const visibleTo: Prisma.TagWhereInput = {
      studySetTag: {
        some: {
          studySet: {
            OR: [
              { visibility: StudySetVisibility.PUBLIC },
              { ownerId: userId },
            ],
          },
        },
      },
    };
    const matches: Prisma.TagWhereInput = query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { slug: { contains: slugify(query) } },
          ],
        }
      : {};

    return this.prisma.tag.findMany({
      where: { AND: [visibleTo, matches] },
      orderBy: [{ studySetTag: { _count: 'desc' } }, { name: 'asc' }],
      take: limit,
      select: { id: true, name: true, slug: true },
    });
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<{
    data: Tag[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const where: Prisma.TagWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await this.prisma.$transaction([
      this.prisma.tag.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tag.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Tag> {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  async update(id: string, dto: UpdateTagDto): Promise<Tag> {
    const existing = await this.findOne(id);
    const name = dto.name ?? existing.name;
    const slug = slugify(name);

    const duplicate = await this.prisma.tag.findFirst({
      where: {
        id: { not: id },
        OR: [{ name }, { slug }],
      },
    });

    if (duplicate) {
      if (duplicate.slug === slug) {
        throw new ConflictException('Tag slug already exists');
      }

      throw new ConflictException('Tag name already exists');
    }

    const updated = await this.prisma.tag.update({
      where: { id },
      data: {
        name,
        slug,
      },
    });

    // Every set carrying this tag embeds its name in its search document.
    const links = await this.prisma.studySetTag.findMany({
      where: { tagId: id },
      select: { studySetId: true },
    });
    await this.searchSync.enqueueSyncMany(links.map((l) => l.studySetId));
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id);

    const linkedStudySets = await this.prisma.studySetTag.count({
      where: { tagId: id },
    });

    if (linkedStudySets > 0) {
      throw new ConflictException(
        'Tag is attached to study sets and cannot be deleted',
      );
    }

    await this.prisma.tag.delete({
      where: { id },
    });
  }
}
