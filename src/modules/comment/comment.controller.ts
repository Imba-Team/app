import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
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
import { UpdateCommentDto } from './dtos/update-comment.dto';

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Patch(':commentId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Edit own comment' })
  @ApiParam({ name: 'commentId' })
  @ApiBody({ type: UpdateCommentDto })
  async updateComment(
    @CurrentUser() user: IUser,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<ResponseDto<CommentResponseDto>> {
    const comment = await this.commentService.updateComment(
      user.id,
      commentId,
      dto,
    );
    const data = plainToInstance(CommentResponseDto, comment, {
      excludeExtraneousValues: true,
    });

    return { ok: true, message: 'Comment updated', data };
  }

  @Delete(':commentId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Soft-delete a comment' })
  @ApiParam({ name: 'commentId' })
  async deleteComment(
    @CurrentUser() user: IUser,
    @Param('commentId') commentId: string,
  ): Promise<ResponseDto<{ success: true }>> {
    const data = await this.commentService.deleteComment(user.id, commentId);

    return { ok: true, message: 'Comment deleted', data };
  }
}
