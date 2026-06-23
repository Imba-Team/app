import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { CommentService } from './comment.service';
import { CommentResponseDto } from './dtos/comment-response.dto';
import { CreateCommentDto } from './dtos/create-comment.dto';
import { PaginationDto } from './dtos/pagination.dto';

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('study-sets/:studySetId/comments')
export class StudySetCommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a top-level comment' })
  @ApiBody({ type: CreateCommentDto })
  async createComment(
    @CurrentUser() user: IUser,
    @Param('studySetId') studySetId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<ResponseDto<CommentResponseDto>> {
    const comment = await this.commentService.createComment(
      user.id,
      studySetId,
      dto,
    );
    const data = plainToInstance(CommentResponseDto, comment, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Comment created', data };
  }

  @Post(':commentId/replies')
  @HttpCode(201)
  @ApiOperation({ summary: 'Reply to a comment' })
  @ApiBody({ type: CreateCommentDto })
  @ApiParam({ name: 'commentId' })
  async createReply(
    @CurrentUser() user: IUser,
    @Param('studySetId') studySetId: string,
    @Param('commentId') commentId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<ResponseDto<CommentResponseDto>> {
    const comment = await this.commentService.createComment(
      user.id,
      studySetId,
      {
        ...dto,
        parentCommentId: commentId,
      },
    );
    const data = plainToInstance(CommentResponseDto, comment, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Reply created', data };
  }

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List top-level comments for a study set' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async listComments(
    @Param('studySetId') studySetId: string,
    @Query() pagination: PaginationDto,
  ): Promise<ResponseDto<CommentResponseDto[]>> {
    const result = await this.commentService.listComments(
      studySetId,
      pagination,
    );
    const data = plainToInstance(CommentResponseDto, result.data, {
      excludeExtraneousValues: true,
    });

    return {
      ok: true,
      message: 'Comments retrieved',
      data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Get(':commentId/replies')
  @HttpCode(200)
  @ApiOperation({ summary: 'List replies for a comment' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiParam({ name: 'commentId' })
  async listReplies(
    @Param('studySetId') studySetId: string,
    @Param('commentId') commentId: string,
    @Query() pagination: PaginationDto,
  ): Promise<ResponseDto<CommentResponseDto[]>> {
    const result = await this.commentService.listReplies(
      studySetId,
      commentId,
      pagination,
    );
    const data = plainToInstance(CommentResponseDto, result.data, {
      excludeExtraneousValues: true,
    });

    return {
      ok: true,
      message: 'Replies retrieved',
      data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }
}
