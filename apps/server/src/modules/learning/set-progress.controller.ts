import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { SetProgressSummaryDto } from './dtos/answer-response.dto';
import { LearningService } from './learning.service';

@ApiTags('Learning')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('study-sets')
export class SetProgressController {
  constructor(private readonly learningService: LearningService) {}

  @Get(':setId/my-progress')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Read my mastery rollup for a study set',
    description:
      'Returns { totalCards, newCount, learningCount, masteredCount }. Cache-aside via Redis (5-min TTL, invalidated on every answer).',
  })
  async getMine(
    @CurrentUser() user: IUser,
    @Param('setId', new ParseUUIDPipe()) setId: string,
  ): Promise<ResponseDto<SetProgressSummaryDto>> {
    const data = await this.learningService.getSetProgress(user.id, setId);
    return { ok: true, message: 'Set progress retrieved', data };
  }
}
