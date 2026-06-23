import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Tag } from '@prisma/client';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { slugify } from 'src/common/utils/sligify';

import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
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

  async findOrCreateByName(name: string): Promise<Tag> {
    const slug = slugify(name);

    const existing = await this.prisma.tag.findFirst({
      where: {
        OR: [{ slug }, { name }],
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.tag.create({
      data: {
        name,
        slug,
      },
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

    return this.prisma.tag.update({
      where: { id },
      data: {
        name,
        slug,
      },
    });
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
