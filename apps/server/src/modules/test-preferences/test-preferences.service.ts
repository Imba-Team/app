import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  LearnAnswerDirection,
  Prisma,
  StudyStrictness,
  TestQuestionType,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';

import { TestPreferencesResponseDto } from './dtos/test-preferences-response.dto';
import { UpdateTestPreferencesDto } from './dtos/update-test-preferences.dto';

/**
 * Effective defaults returned when a learner has no per-set row.
 * Kept in sync with the Prisma column defaults so a cache-miss lookup
 * and a fresh insert produce identical responses.
 */
export const DEFAULT_TEST_PREFERENCES: TestPreferencesResponseDto = {
  questionCount: 20,
  allowedTypes: [
    TestQuestionType.TEST_MC,
    TestQuestionType.TEST_WRITTEN,
    TestQuestionType.TEST_TF,
    TestQuestionType.TEST_MATCH,
  ],
  answerDirection: LearnAnswerDirection.TERM_TO_DEFINITION,
  strictness: StudyStrictness.NORMAL,
  starredOnly: false,
  shuffleEnabled: true,
  showResultsPerQuestion: false,
  matchingPairCount: 5,
};

@Injectable()
export class TestPreferencesService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
  ) {
    this.logger.setContext(TestPreferencesService.name);
  }

  async getForCaller(
    userId: string,
    setId: string,
  ): Promise<TestPreferencesResponseDto> {
    await this.ensureCanAccess(userId, setId);
    const row = await this.prisma.userTestPreferences.findUnique({
      where: { userId_setId: { userId, setId } },
    });
    if (!row) return { ...DEFAULT_TEST_PREFERENCES };
    return this.toResponse(row);
  }

  async update(
    userId: string,
    setId: string,
    patch: UpdateTestPreferencesDto,
  ): Promise<TestPreferencesResponseDto> {
    await this.ensureCanAccess(userId, setId);

    const data: Prisma.UserTestPreferencesUncheckedUpdateInput = {};
    if (patch.questionCount !== undefined)
      data.questionCount = patch.questionCount;
    if (patch.allowedTypes !== undefined)
      data.allowedTypes = { set: patch.allowedTypes };
    if (patch.answerDirection !== undefined)
      data.answerDirection = patch.answerDirection;
    if (patch.strictness !== undefined) data.strictness = patch.strictness;
    if (patch.starredOnly !== undefined) data.starredOnly = patch.starredOnly;
    if (patch.shuffleEnabled !== undefined)
      data.shuffleEnabled = patch.shuffleEnabled;
    if (patch.showResultsPerQuestion !== undefined)
      data.showResultsPerQuestion = patch.showResultsPerQuestion;
    if (patch.matchingPairCount !== undefined)
      data.matchingPairCount = patch.matchingPairCount;

    const row = await this.prisma.userTestPreferences.upsert({
      where: { userId_setId: { userId, setId } },
      create: {
        userId,
        setId,
        // On first write we honour the patch's values on top of the
        // schema defaults — Prisma fills anything the caller omitted.
        questionCount:
          patch.questionCount ?? DEFAULT_TEST_PREFERENCES.questionCount,
        allowedTypes:
          patch.allowedTypes ?? DEFAULT_TEST_PREFERENCES.allowedTypes,
        answerDirection:
          patch.answerDirection ?? DEFAULT_TEST_PREFERENCES.answerDirection,
        strictness: patch.strictness ?? DEFAULT_TEST_PREFERENCES.strictness,
        starredOnly: patch.starredOnly ?? DEFAULT_TEST_PREFERENCES.starredOnly,
        shuffleEnabled:
          patch.shuffleEnabled ?? DEFAULT_TEST_PREFERENCES.shuffleEnabled,
        showResultsPerQuestion:
          patch.showResultsPerQuestion ??
          DEFAULT_TEST_PREFERENCES.showResultsPerQuestion,
        matchingPairCount:
          patch.matchingPairCount ?? DEFAULT_TEST_PREFERENCES.matchingPairCount,
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
    questionCount: number;
    allowedTypes: string[];
    answerDirection: LearnAnswerDirection;
    strictness: StudyStrictness;
    starredOnly: boolean;
    shuffleEnabled: boolean;
    showResultsPerQuestion: boolean;
    matchingPairCount: number;
  }): TestPreferencesResponseDto {
    return plainToInstance(
      TestPreferencesResponseDto,
      {
        questionCount: row.questionCount,
        // Cast the raw string[] back to the enum union. Any stale
        // values that don't map (shouldn't happen in practice) are
        // filtered so the generator never sees garbage.
        allowedTypes: row.allowedTypes.filter((t): t is TestQuestionType =>
          Object.values(TestQuestionType).includes(t as TestQuestionType),
        ),
        answerDirection: row.answerDirection,
        strictness: row.strictness,
        starredOnly: row.starredOnly,
        shuffleEnabled: row.shuffleEnabled,
        showResultsPerQuestion: row.showResultsPerQuestion,
        matchingPairCount: row.matchingPairCount,
      },
      { excludeExtraneousValues: true },
    );
  }
}
