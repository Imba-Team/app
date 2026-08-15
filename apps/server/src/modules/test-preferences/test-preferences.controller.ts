import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ApiOkEnvelope } from 'src/common/decorators/api-envelope.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { TestPreferencesResponseDto } from './dtos/test-preferences-response.dto';
import { UpdateTestPreferencesDto } from './dtos/update-test-preferences.dto';
import { TestPreferencesService } from './test-preferences.service';

@ApiTags('Test')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('sets/:setId/test-preferences')
export class TestPreferencesController {
  constructor(private readonly service: TestPreferencesService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get my Test Mode preferences for this set',
    description:
      'Returns the caller’s per-set Test preferences, or the module-level defaults when the learner has never overridden anything.',
  })
  @ApiOkEnvelope(TestPreferencesResponseDto, {
    description: 'Test preferences read',
  })
  async get(
    @CurrentUser() user: IUser,
    @Param('setId', new ParseUUIDPipe()) setId: string,
  ): Promise<ResponseDto<TestPreferencesResponseDto>> {
    const data = await this.service.getForCaller(user.id, setId);
    return { ok: true, message: 'Test preferences read', data };
  }

  @Put()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Update my Test Mode preferences for this set',
    description:
      'Partial update. Only fields present in the body are written; omitted fields keep their prior value (or the module default on first write).',
  })
  @ApiOkEnvelope(TestPreferencesResponseDto, {
    description: 'Test preferences updated',
  })
  async update(
    @CurrentUser() user: IUser,
    @Param('setId', new ParseUUIDPipe()) setId: string,
    @Body() dto: UpdateTestPreferencesDto,
  ): Promise<ResponseDto<TestPreferencesResponseDto>> {
    const data = await this.service.update(user.id, setId, dto);
    return { ok: true, message: 'Test preferences updated', data };
  }
}
