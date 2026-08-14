import { ForbiddenException, Injectable } from '@nestjs/common';
import { LearnAnswerDirection, Prisma, StudyStrictness } from '@prisma/client';
import { plainToInstance } from 'class-transformer';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';

import { ApplyPresetDto, PacePreset } from './dtos/apply-preset.dto';
import { SetPreferencesResponseDto } from './dtos/set-preferences-response.dto';
import { UpdateSetPreferencesDto } from './dtos/update-set-preferences.dto';

/**
 * Effective defaults returned when a learner has no per-set row.
 * Kept in sync with the Prisma column defaults so a fresh row and a
 * cache-miss lookup produce identical responses.
 */
export const DEFAULT_SET_PREFERENCES: SetPreferencesResponseDto = {
  batchSize: 10,
  mcWrittenBias: 1.0,
  masteryThreshold: 3.0,
  hintMultiplier: 0.5,
  autoAdvance: false,
  autoAdvanceMs: 1400,
  audioEnabled: false,
  soundEffectsEnabled: false,
  starredOnly: false,
  shuffleEnabled: true,
  strictness: StudyStrictness.NORMAL,
  answerDirection: LearnAnswerDirection.TERM_TO_DEFINITION,
};

type PresetPatch = Pick<
  UpdateSetPreferencesDto,
  'batchSize' | 'mcWrittenBias' | 'masteryThreshold' | 'autoAdvanceMs'
>;

/**
 * Pace presets. Only touch the four knobs learners actually associate
 * with pace — hint multiplier and audio stay put so switching preset
 * doesn't quietly rewrite unrelated toggles.
 */
export const PACE_PRESET_PATCHES: Record<PacePreset, PresetPatch> = {
  chill: {
    batchSize: 5,
    mcWrittenBias: 0.5,
    masteryThreshold: 2.0,
    autoAdvanceMs: 2000,
  },
  default: {
    batchSize: 10,
    mcWrittenBias: 1.0,
    masteryThreshold: 3.0,
    autoAdvanceMs: 1400,
  },
  aggressive: {
    batchSize: 15,
    mcWrittenBias: 1.5,
    masteryThreshold: 4.0,
    autoAdvanceMs: 1000,
  },
};

@Injectable()
export class SetPreferencesService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
  ) {
    this.logger.setContext(SetPreferencesService.name);
  }

  async getForCaller(
    userId: string,
    setId: string,
  ): Promise<SetPreferencesResponseDto> {
    await this.ensureCanAccess(userId, setId);
    const row = await this.prisma.userSetPreferences.findUnique({
      where: { userId_setId: { userId, setId } },
    });
    if (!row) return { ...DEFAULT_SET_PREFERENCES };
    return this.toResponse(row);
  }

  async update(
    userId: string,
    setId: string,
    patch: UpdateSetPreferencesDto,
  ): Promise<SetPreferencesResponseDto> {
    await this.ensureCanAccess(userId, setId);
    return this.upsertAndReturn(userId, setId, patch);
  }

  async applyPreset(
    userId: string,
    setId: string,
    dto: ApplyPresetDto,
  ): Promise<SetPreferencesResponseDto> {
    await this.ensureCanAccess(userId, setId);
    const patch = PACE_PRESET_PATCHES[dto.preset];
    this.logger.log(
      `Applied preset "${dto.preset}" for userId=${userId}, setId=${setId}`,
    );
    return this.upsertAndReturn(userId, setId, patch);
  }

  private async upsertAndReturn(
    userId: string,
    setId: string,
    patch: UpdateSetPreferencesDto,
  ): Promise<SetPreferencesResponseDto> {
    const data: Prisma.UserSetPreferencesUncheckedUpdateInput = {};
    if (patch.batchSize !== undefined) data.batchSize = patch.batchSize;
    if (patch.mcWrittenBias !== undefined)
      data.mcWrittenBias = new Prisma.Decimal(patch.mcWrittenBias.toFixed(2));
    if (patch.masteryThreshold !== undefined)
      data.masteryThreshold = new Prisma.Decimal(
        patch.masteryThreshold.toFixed(2),
      );
    if (patch.hintMultiplier !== undefined)
      data.hintMultiplier = new Prisma.Decimal(patch.hintMultiplier.toFixed(2));
    if (patch.autoAdvance !== undefined) data.autoAdvance = patch.autoAdvance;
    if (patch.autoAdvanceMs !== undefined)
      data.autoAdvanceMs = patch.autoAdvanceMs;
    if (patch.audioEnabled !== undefined)
      data.audioEnabled = patch.audioEnabled;
    if (patch.soundEffectsEnabled !== undefined)
      data.soundEffectsEnabled = patch.soundEffectsEnabled;
    if (patch.starredOnly !== undefined) data.starredOnly = patch.starredOnly;
    if (patch.shuffleEnabled !== undefined)
      data.shuffleEnabled = patch.shuffleEnabled;
    if (patch.strictness !== undefined) data.strictness = patch.strictness;
    if (patch.answerDirection !== undefined)
      data.answerDirection = patch.answerDirection;

    const row = await this.prisma.userSetPreferences.upsert({
      where: { userId_setId: { userId, setId } },
      create: {
        userId,
        setId,
        // On first write we honour the patch's values on top of the
        // schema defaults — Prisma fills anything the caller omitted.
        batchSize: patch.batchSize ?? DEFAULT_SET_PREFERENCES.batchSize,
        mcWrittenBias: new Prisma.Decimal(
          (
            patch.mcWrittenBias ?? DEFAULT_SET_PREFERENCES.mcWrittenBias
          ).toFixed(2),
        ),
        masteryThreshold: new Prisma.Decimal(
          (
            patch.masteryThreshold ?? DEFAULT_SET_PREFERENCES.masteryThreshold
          ).toFixed(2),
        ),
        hintMultiplier: new Prisma.Decimal(
          (
            patch.hintMultiplier ?? DEFAULT_SET_PREFERENCES.hintMultiplier
          ).toFixed(2),
        ),
        autoAdvance: patch.autoAdvance ?? DEFAULT_SET_PREFERENCES.autoAdvance,
        autoAdvanceMs:
          patch.autoAdvanceMs ?? DEFAULT_SET_PREFERENCES.autoAdvanceMs,
        audioEnabled:
          patch.audioEnabled ?? DEFAULT_SET_PREFERENCES.audioEnabled,
        soundEffectsEnabled:
          patch.soundEffectsEnabled ??
          DEFAULT_SET_PREFERENCES.soundEffectsEnabled,
        starredOnly: patch.starredOnly ?? DEFAULT_SET_PREFERENCES.starredOnly,
        shuffleEnabled:
          patch.shuffleEnabled ?? DEFAULT_SET_PREFERENCES.shuffleEnabled,
        strictness: patch.strictness ?? DEFAULT_SET_PREFERENCES.strictness,
        answerDirection:
          patch.answerDirection ?? DEFAULT_SET_PREFERENCES.answerDirection,
      },
      update: data,
    });
    return this.toResponse(row);
  }

  private async ensureCanAccess(userId: string, setId: string) {
    const allowed = await this.studySetService.canAccess(userId, setId);
    if (!allowed) throw new ForbiddenException('Study set is private');
  }

  private toResponse(row: {
    batchSize: number;
    mcWrittenBias: Prisma.Decimal;
    masteryThreshold: Prisma.Decimal;
    hintMultiplier: Prisma.Decimal;
    autoAdvance: boolean;
    autoAdvanceMs: number;
    audioEnabled: boolean;
    soundEffectsEnabled: boolean;
    starredOnly: boolean;
    shuffleEnabled: boolean;
    strictness: StudyStrictness;
    answerDirection: LearnAnswerDirection;
  }): SetPreferencesResponseDto {
    return plainToInstance(
      SetPreferencesResponseDto,
      {
        batchSize: row.batchSize,
        mcWrittenBias: Number(row.mcWrittenBias),
        masteryThreshold: Number(row.masteryThreshold),
        hintMultiplier: Number(row.hintMultiplier),
        autoAdvance: row.autoAdvance,
        autoAdvanceMs: row.autoAdvanceMs,
        audioEnabled: row.audioEnabled,
        soundEffectsEnabled: row.soundEffectsEnabled,
        starredOnly: row.starredOnly,
        shuffleEnabled: row.shuffleEnabled,
        strictness: row.strictness,
        answerDirection: row.answerDirection,
      },
      { excludeExtraneousValues: true },
    );
  }
}
