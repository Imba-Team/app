import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
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

import { ApplyPresetDto } from './dtos/apply-preset.dto';
import { SetPreferencesResponseDto } from './dtos/set-preferences-response.dto';
import { UpdateSetPreferencesDto } from './dtos/update-set-preferences.dto';
import { SetPreferencesService } from './set-preferences.service';

@ApiTags('Learning')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('sets/:setId/preferences')
export class SetPreferencesController {
  constructor(private readonly service: SetPreferencesService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get my study preferences for this set',
    description:
      'Returns the caller’s per-set preferences, or the module-level defaults when the learner has never overridden anything.',
  })
  @ApiOkEnvelope(SetPreferencesResponseDto, { description: 'Preferences read' })
  async get(
    @CurrentUser() user: IUser,
    @Param('setId', new ParseUUIDPipe()) setId: string,
  ): Promise<ResponseDto<SetPreferencesResponseDto>> {
    const data = await this.service.getForCaller(user.id, setId);
    return { ok: true, message: 'Preferences read', data };
  }

  @Put()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Update my study preferences for this set',
    description:
      'Partial update. Only fields present in the body are written; omitted fields keep their prior value (or the module default on first write).',
  })
  @ApiOkEnvelope(SetPreferencesResponseDto, {
    description: 'Preferences updated',
  })
  async update(
    @CurrentUser() user: IUser,
    @Param('setId', new ParseUUIDPipe()) setId: string,
    @Body() dto: UpdateSetPreferencesDto,
  ): Promise<ResponseDto<SetPreferencesResponseDto>> {
    const data = await this.service.update(user.id, setId, dto);
    return { ok: true, message: 'Preferences updated', data };
  }

  @Post('apply-preset')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Apply a pace preset',
    description:
      'Overwrites batchSize, mcWrittenBias, masteryThreshold, and autoAdvanceMs with the values baked into the chosen preset. Other fields (hintMultiplier, autoAdvance, audioEnabled) are left as-is so the preset does not silently rewrite unrelated toggles.',
  })
  @ApiOkEnvelope(SetPreferencesResponseDto, {
    description: 'Preset applied',
  })
  async applyPreset(
    @CurrentUser() user: IUser,
    @Param('setId', new ParseUUIDPipe()) setId: string,
    @Body() dto: ApplyPresetDto,
  ): Promise<ResponseDto<SetPreferencesResponseDto>> {
    const data = await this.service.applyPreset(user.id, setId, dto);
    return { ok: true, message: 'Preset applied', data };
  }
}
