import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Comment, Prisma } from '@prisma/client';

import { PrismaService } from 'src/common/prisma/prisma.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';

import { CommentResponseDto } from './dtos/comment-response.dto';
import { CreateCommentDto } from './dtos/create-comment.dto';
import { PaginationDto } from './dtos/pagination.dto';
import { UpdateCommentDto } from './dtos/update-comment.dto';

type CommentWithAuthor = Comment & {
  user: {
    id: string;
    username: string | null;
    profilePicture: string | null;
  };
  _count?: {
    replies: number;
  };
};

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
  ) {}

  async createComment(
    currentUserId: string,
    studySetId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const studySet = await this.prisma.studySet.findUnique({
      where: { id: studySetId },
      select: { id: true, visibility: true },
    });

    if (!studySet) {
      throw new NotFoundException('Study set not found');
    }

    const canAccess = await this.studySetService.canAccess(
      currentUserId,
      studySetId,
    );
    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this study set');
    }

    if (dto.parentCommentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentCommentId },
        select: {
          id: true,
          studySetId: true,
          parentCommentId: true,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent comment not found');
      }

      if (parent.studySetId !== studySetId) {
        throw new BadRequestException(
          'Parent comment does not belong to this study set',
        );
      }

      if (parent.parentCommentId !== null) {
        throw new BadRequestException(
          'Replies cannot be nested beyond one level',
        );
      }
    }

    const created = await this.prisma.comment.create({
      data: {
        content: dto.content,
        userId: currentUserId,
        studySetId,
        parentCommentId: dto.parentCommentId ?? null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profilePicture: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    return this.mapComment(created);
  }

  async updateComment(
    currentUserId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        isDeleted: true,
      },
    });

    if (!existing || existing.isDeleted) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.userId !== currentUserId) {
      throw new ForbiddenException('You can only edit your own comment');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profilePicture: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    return this.mapComment(updated);
  }

  async deleteComment(
    currentUserId: string,
    commentId: string,
  ): Promise<{ success: true }> {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        studySetId: true,
        userId: true,
        isDeleted: true,
        studySet: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!existing || existing.isDeleted) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.userId !== currentUserId) {
      const canModerate = await this.studySetService.canEdit(
        currentUserId,
        existing.studySetId,
      );

      if (!canModerate) {
        throw new ForbiddenException(
          'You do not have permission to delete this comment',
        );
      }
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        isDeleted: true,
      },
    });

    return { success: true };
  }

  async listComments(studySetId: string, pagination: PaginationDto) {
    const studySet = await this.prisma.studySet.findUnique({
      where: { id: studySetId },
      select: { id: true },
    });

    if (!studySet) {
      throw new NotFoundException('Study set not found');
    }

    const { page, limit, skip } = this.normalizePagination(pagination);

    const where: Prisma.CommentWhereInput = {
      studySetId,
      parentCommentId: null,
    };

    const [comments, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profilePicture: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      data: comments.map((comment) => this.mapComment(comment)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listReplies(
    studySetId: string,
    parentCommentId: string,
    pagination: PaginationDto,
  ) {
    const parent = await this.prisma.comment.findUnique({
      where: { id: parentCommentId },
      select: {
        id: true,
        studySetId: true,
      },
    });

    if (!parent || parent.studySetId !== studySetId) {
      throw new NotFoundException('Parent comment not found');
    }

    const { page, limit, skip } = this.normalizePagination(pagination);

    const where: Prisma.CommentWhereInput = {
      parentCommentId,
      studySetId,
    };

    const [replies, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profilePicture: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      data: replies.map((reply) => this.mapComment(reply, 0)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private normalizePagination(pagination: PaginationDto): {
    page: number;
    limit: number;
    skip: number;
  } {
    const parsedPage = Number(pagination.page ?? 1);
    const parsedLimit = Number(pagination.limit ?? 20);

    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limitCandidate =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;
    const limit = Math.min(limitCandidate, 100);

    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }

  private mapComment(
    comment: CommentWithAuthor,
    repliesCount = 0,
  ): CommentResponseDto {
    return {
      id: comment.id,
      content: comment.isDeleted ? '[deleted]' : comment.content,
      isDeleted: comment.isDeleted,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.isDeleted
        ? null
        : {
            id: comment.user.id,
            username: comment.user.username ?? '',
            profilePicture: comment.user.profilePicture ?? '',
          },
      replyCount: comment._count?.replies ?? repliesCount,
    };
  }
}
