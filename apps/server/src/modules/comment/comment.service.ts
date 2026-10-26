import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { UserStatus } from 'src/common/interfaces/user.interface';
import { MediaService } from 'src/common/media/media.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';

import { CommentResponseDto } from './dtos/comment-response.dto';
import { CreateCommentDto } from './dtos/create-comment.dto';
import { PaginationDto } from './dtos/pagination.dto';
import { UpdateCommentDto } from './dtos/update-comment.dto';

// One include for every comment query: the author fields needed for
// display, and a reply count that ignores deleted replies (they're hidden).
const commentInclude = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      profilePicture: true,
      status: true,
    },
  },
  _count: { select: { replies: { where: { isDeleted: false } } } },
} satisfies Prisma.CommentInclude;

type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: typeof commentInclude;
}>;

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
    private readonly media: MediaService,
  ) {}

  /**
   * Comments inherit the set's visibility: anyone who can't open the set
   * (e.g. a private set they don't own or collaborate on) can't read its
   * discussion either. Throws 404 for a missing set, 403 for no access.
   */
  private async ensureCanReadStudySet(
    currentUserId: string,
    studySetId: string,
  ): Promise<void> {
    const studySet = await this.prisma.studySet.findUnique({
      where: { id: studySetId },
      select: { id: true },
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
  }

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
      include: commentInclude,
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
      include: commentInclude,
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

  async listComments(
    currentUserId: string,
    studySetId: string,
    pagination: PaginationDto,
  ) {
    await this.ensureCanReadStudySet(currentUserId, studySetId);

    const { page, limit, skip } = this.normalizePagination(pagination);

    // A deleted comment only stays visible as a placeholder while it still
    // has live replies; otherwise it's dropped (and not counted).
    const where: Prisma.CommentWhereInput = {
      studySetId,
      parentCommentId: null,
      OR: [{ isDeleted: false }, { replies: { some: { isDeleted: false } } }],
    };

    const [comments, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        include: commentInclude,
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
    currentUserId: string,
    studySetId: string,
    parentCommentId: string,
    pagination: PaginationDto,
  ) {
    await this.ensureCanReadStudySet(currentUserId, studySetId);

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

    // Replies can't have replies of their own, so deleted ones are simply hidden.
    const where: Prisma.CommentWhereInput = {
      parentCommentId,
      studySetId,
      isDeleted: false,
    };

    const [replies, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        include: commentInclude,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      data: replies.map((reply) => this.mapComment(reply)),
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

  private mapComment(comment: CommentWithAuthor): CommentResponseDto {
    return {
      id: comment.id,
      content: comment.isDeleted ? '[deleted]' : comment.content,
      isDeleted: comment.isDeleted,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.isDeleted ? null : this.mapAuthor(comment.user),
      replyCount: comment._count.replies,
    };
  }

  private mapAuthor(
    user: CommentWithAuthor['user'],
  ): NonNullable<CommentResponseDto['author']> {
    // Soft-deleted accounts are anonymised (MIM-5); show a neutral label
    // instead of their generated `deleted_<id>` username.
    if (user.status === UserStatus.DELETED) {
      return {
        id: user.id,
        username: '',
        name: 'Deleted user',
        profilePicture: null,
      };
    }
    return {
      id: user.id,
      username: user.username ?? '',
      name: user.displayName || user.username || '',
      profilePicture: this.media.resolveUrl(user.profilePicture),
    };
  }
}
