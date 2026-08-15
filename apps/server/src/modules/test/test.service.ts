import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LearnAnswerDirection,
  Prisma,
  TestAttemptStatus,
  TestQuestionType,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { Redis } from 'ioredis';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { REDIS_CLIENT } from 'src/common/redis/redis.constants';
import { shuffle } from 'src/modules/learning/domain/shuffle';
import { SrsService } from 'src/modules/srs/srs.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';
import { TestPreferencesService } from 'src/modules/test-preferences/test-preferences.service';

import { ListTestHistoryQueryDto } from './dtos/list-test-history-query.dto';
import { StartTestAttemptDto } from './dtos/start-test-attempt.dto';
import { StartTestAttemptResponseDto } from './dtos/start-test-attempt-response.dto';
import { SubmitTestAttemptDto } from './dtos/submit-test-attempt.dto';
import {
  TestAttemptResultDto,
  TestPairResultDto,
  TestQuestionResultDto,
} from './dtos/test-attempt-result.dto';
import { TestHistoryItemDto } from './dtos/test-history-item.dto';
import { TestMatchingPairDto, TestQuestionDto } from './dtos/test-question.dto';
import {
  gradeTestAttempt,
  type GradableAnswer,
  type GradableQuestion,
} from './domain/grade-test-attempt';
import {
  generateTest,
  type GeneratorCard,
} from './domain/test-question-generator';

/**
 * IN_PROGRESS attempts older than this get flipped to ABANDONED by
 * the opportunistic sweep. A test is a single-sitting flow — a
 * day-old un-submitted attempt is essentially forgotten.
 */
export const TEST_ATTEMPT_ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

/** Rating fed to SRS per question — matches SRS §9.4. */
type Sm2Rating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

@Injectable()
export class TestService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
    private readonly testPreferencesService: TestPreferencesService,
    private readonly srsService: SrsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.logger.setContext(TestService.name);
    // Redis is injected for future idempotency-key support on submit;
    // not used yet but the pattern matches SrsService / LearningService
    // so the wiring is ready when we need it.
    void this.redis;
  }

  /**
   * Concurrent-attempt guard + sweep. Flip long-idle IN_PROGRESS rows
   * to ABANDONED so a stale attempt doesn't block a new one. Callers
   * fire this before any read that filters by IN_PROGRESS.
   */
  private async sweepAbandonedAttempts(userId: string): Promise<void> {
    const cutoff = new Date(Date.now() - TEST_ATTEMPT_ABANDON_AFTER_MS);
    const updated = await this.prisma.testAttempt.updateMany({
      where: {
        userId,
        status: TestAttemptStatus.IN_PROGRESS,
        createdAt: { lt: cutoff },
      },
      data: { status: TestAttemptStatus.ABANDONED },
    });
    if (updated.count > 0) {
      this.logger.debug(
        `Marked ${updated.count} test attempt(s) ABANDONED for userId=${userId}`,
      );
    }
  }

  async startAttempt(
    userId: string,
    dto: StartTestAttemptDto,
  ): Promise<StartTestAttemptResponseDto> {
    const canAccess = await this.studySetService.canAccess(
      userId,
      dto.studySetId,
    );
    if (!canAccess) throw new ForbiddenException('Study set is private');

    await this.sweepAbandonedAttempts(userId);

    // Concurrent-attempt guard: return the existing IN_PROGRESS
    // attempt if one exists for this (user, set). Prevents accidental
    // stacking from rapid clicks / tab reopens. The learner has to
    // explicitly abandon or submit to start fresh.
    const existing = await this.prisma.testAttempt.findFirst({
      where: {
        userId,
        studySetId: dto.studySetId,
        status: TestAttemptStatus.IN_PROGRESS,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        testQuestionAttempts: {
          orderBy: { orderIndex: 'asc' },
          include: { matchingPairs: true },
        },
      },
    });
    if (existing) {
      return await this.buildStartResponse(existing, true);
    }

    // Load prefs + candidate pool. StarredOnly narrows via
    // UserCardProgress.isStarred — cards without a progress row
    // count as unstarred, so the filter drops them naturally.
    const preferences = await this.testPreferencesService.getForCaller(
      userId,
      dto.studySetId,
    );
    const cards = await this.prisma.flashcard.findMany({
      where: { studySetId: dto.studySetId },
      select: { id: true, term: true, definition: true },
      orderBy: { orderIndex: 'asc' },
    });
    let pool: GeneratorCard[] = cards;
    if (preferences.starredOnly) {
      const progress = await this.prisma.userCardProgress.findMany({
        where: {
          userId,
          cardId: { in: cards.map((c) => c.id) },
          isStarred: true,
        },
        select: { cardId: true },
      });
      const starred = new Set(progress.map((p) => p.cardId));
      pool = cards.filter((c) => starred.has(c.id));
    }

    const generated = generateTest(pool, {
      questionCount: preferences.questionCount,
      allowedTypes: preferences.allowedTypes,
      answerDirection: preferences.answerDirection,
      shuffleEnabled: preferences.shuffleEnabled,
      matchingPairCount: preferences.matchingPairCount,
    });
    if (generated.questions.length === 0) {
      throw new ConflictException(
        'Not enough cards to generate a test with your current settings',
      );
    }

    // Persist attempt + questions + matching pairs in one transaction.
    // Prisma's nested-create can't express matching pairs on a nested
    // create-many, so we hand-roll the inserts.
    const attempt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.testAttempt.create({
        data: {
          userId,
          studySetId: dto.studySetId,
          status: TestAttemptStatus.IN_PROGRESS,
          questionCount: preferences.questionCount,
          totalQuestions: generated.totalQuestions,
        },
      });
      // Create question rows one by one so we can spawn matching pair
      // rows underneath each. Batches are small (≤20 questions) so
      // this stays fast.
      for (const spec of generated.questions) {
        const question = await tx.testQuestionAttempt.create({
          data: {
            testAttemptId: created.id,
            flashcardId: spec.flashcardId,
            questionType: spec.questionType,
            promptText: spec.promptText,
            expectedAnswer: spec.expectedAnswer,
            choices: spec.choices,
            correctChoiceIndex: spec.correctChoiceIndex,
            answerDirection: spec.answerDirection,
            orderIndex: spec.orderIndex,
          },
        });
        if (
          spec.questionType === TestQuestionType.TEST_MATCH &&
          spec.matchingPairs.length > 0
        ) {
          await tx.testMatchingPair.createMany({
            data: spec.matchingPairs.map((p) => ({
              testQuestionAttemptId: question.id,
              flashcardId: p.flashcardId,
            })),
          });
        }
      }
      return tx.testAttempt.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          testQuestionAttempts: {
            orderBy: { orderIndex: 'asc' },
            include: { matchingPairs: true },
          },
        },
      });
    });

    this.logger.log(
      `Test attempt started: id=${attempt.id}, userId=${userId}, setId=${dto.studySetId}, totalQuestions=${generated.totalQuestions}`,
    );

    return await this.buildStartResponse(attempt, false);
  }

  async submitAttempt(
    userId: string,
    attemptId: string,
    dto: SubmitTestAttemptDto,
  ): Promise<TestAttemptResultDto> {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        testQuestionAttempts: {
          orderBy: { orderIndex: 'asc' },
          include: { matchingPairs: true },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Test attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status === TestAttemptStatus.COMPLETED) {
      throw new ConflictException('Attempt already submitted');
    }
    if (attempt.status === TestAttemptStatus.ABANDONED) {
      throw new ConflictException('Attempt was abandoned; start a new one');
    }

    const preferences = await this.testPreferencesService.getForCaller(
      userId,
      attempt.studySetId,
    );

    // Grade purely in memory first.
    const gradable: GradableQuestion[] = attempt.testQuestionAttempts.map(
      (q) => ({
        id: q.id,
        flashcardId: q.flashcardId,
        questionType: q.questionType,
        expectedAnswer: q.expectedAnswer,
        choices: q.choices,
        correctChoiceIndex: q.correctChoiceIndex,
        answerDirection: q.answerDirection,
        matchingPairs: q.matchingPairs.map((p) => ({
          pairId: p.id,
          flashcardId: p.flashcardId,
        })),
      }),
    );
    const answers: GradableAnswer[] = dto.answers.map((a) => ({
      questionAttemptId: a.questionAttemptId,
      userAnswer: a.userAnswer,
      selectedChoiceIndex: a.selectedChoiceIndex,
      userIsTrue: a.userIsTrue,
      matchingPicks: a.matchingPicks?.map((p) => ({
        pairId: p.pairId,
        userMatchedFlashcardId: p.userMatchedFlashcardId ?? null,
      })),
    }));
    const graded = gradeTestAttempt(gradable, answers, preferences.strictness);

    // Persist grades + fire SRS in a single transaction so the review
    // and the schedule stay consistent.
    const now = new Date();
    const today = await this.srsService.getUserDayStart(userId, now);
    const durationSeconds = Math.max(
      0,
      Math.floor((now.getTime() - attempt.createdAt.getTime()) / 1000),
    );

    const persisted = await this.prisma.$transaction(async (tx) => {
      for (const result of graded.results) {
        await tx.testQuestionAttempt.update({
          where: { id: result.questionAttemptId },
          data: {
            userAnswer: result.userAnswer,
            selectedChoiceIndex: result.selectedChoiceIndex,
            similarity:
              result.similarity !== null
                ? new Prisma.Decimal(result.similarity.toFixed(3))
                : null,
            isCorrect: result.isCorrect,
          },
        });
        // Matching pairs — update the persisted rows with the
        // learner's picks + judgment.
        for (const pair of result.pairs) {
          await tx.testMatchingPair.update({
            where: { id: pair.pairId },
            data: {
              userMatchedFlashcardId: pair.userMatchedFlashcardId,
              isCorrect: pair.isCorrect,
            },
          });
        }
        // SRS: forward every scored card touch. Matching contributes
        // one review per pair (per SRS §9.4 semantics).
        if (result.questionType === TestQuestionType.TEST_MATCH) {
          for (const pair of result.pairs) {
            await this.srsService.applyReviewByCard(
              tx,
              userId,
              pair.flashcardId,
              this.ratingFor(pair.isCorrect),
              today,
              now,
            );
          }
        } else {
          await this.srsService.applyReviewByCard(
            tx,
            userId,
            result.flashcardId,
            this.ratingFor(result.isCorrect),
            today,
            now,
          );
        }
      }

      const updated = await tx.testAttempt.update({
        where: { id: attempt.id },
        data: {
          status: TestAttemptStatus.COMPLETED,
          score: graded.score,
          totalQuestions: graded.totalSlots,
          correctCount: graded.correctSlots,
          incorrectCount: graded.totalSlots - graded.correctSlots,
          durationSeconds,
          submittedAt: now,
        },
        include: {
          testQuestionAttempts: {
            orderBy: { orderIndex: 'asc' },
            include: { matchingPairs: true },
          },
        },
      });
      return updated;
    });

    this.logger.log(
      `Test attempt submitted: id=${attempt.id}, userId=${userId}, score=${graded.score}, ${graded.correctSlots}/${graded.totalSlots}`,
    );

    return this.buildResultResponse(persisted);
  }

  async abandonAttempt(userId: string, attemptId: string): Promise<void> {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Test attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    if (attempt.status !== TestAttemptStatus.IN_PROGRESS) return;

    await this.prisma.testAttempt.update({
      where: { id: attemptId },
      data: { status: TestAttemptStatus.ABANDONED },
    });
    this.logger.log(`Test attempt abandoned: id=${attemptId}`);
  }

  async listAttempts(
    userId: string,
    query: ListTestHistoryQueryDto,
  ): Promise<{
    items: TestHistoryItemDto[];
    total: number;
    limit: number;
    offset: number;
  }> {
    await this.sweepAbandonedAttempts(userId);

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const where: Prisma.TestAttemptWhereInput = {
      userId,
      ...(query.studySetId ? { studySetId: query.studySetId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.testAttempt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.testAttempt.count({ where }),
    ]);

    const items = rows.map((row) =>
      plainToInstance(
        TestHistoryItemDto,
        {
          attemptId: row.id,
          studySetId: row.studySetId,
          status: row.status,
          score: row.score,
          totalQuestions: row.totalQuestions,
          correctCount: row.correctCount,
          incorrectCount: row.incorrectCount,
          durationSeconds: row.durationSeconds,
          createdAt: row.createdAt,
          submittedAt: row.submittedAt,
        },
        { excludeExtraneousValues: true },
      ),
    );

    return { items, total, limit, offset };
  }

  async getAttempt(
    userId: string,
    attemptId: string,
  ): Promise<TestAttemptResultDto> {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        testQuestionAttempts: {
          orderBy: { orderIndex: 'asc' },
          include: { matchingPairs: true },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Test attempt not found');
    if (attempt.userId !== userId)
      throw new ForbiddenException('Not your attempt');
    return this.buildResultResponse(attempt);
  }

  // ============================================================
  // Response builders
  // ============================================================

  private async buildStartResponse(
    attempt: Prisma.TestAttemptGetPayload<{
      include: {
        testQuestionAttempts: {
          include: { matchingPairs: true };
        };
      };
    }>,
    resumed: boolean,
  ): Promise<StartTestAttemptResponseDto> {
    // Pre-load every flashcard referenced by the attempt (matching
    // anchors need term + definition to render). Learn Mode does the
    // same trick for its batch DTO.
    const cardTexts = await this.loadCardTexts(
      this.collectFlashcardIds(attempt.testQuestionAttempts),
    );

    const questions: TestQuestionDto[] = attempt.testQuestionAttempts.map((q) =>
      this.toQuestionDto(q, cardTexts),
    );

    return plainToInstance(
      StartTestAttemptResponseDto,
      {
        attemptId: attempt.id,
        studySetId: attempt.studySetId,
        createdAt: attempt.createdAt,
        questionCount: attempt.questionCount,
        totalQuestions: attempt.totalQuestions,
        questions,
        resumed,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toQuestionDto(
    q: {
      id: string;
      flashcardId: string;
      questionType: TestQuestionType;
      answerDirection: LearnAnswerDirection;
      promptText: string;
      orderIndex: number;
      choices: string[];
      matchingPairs: {
        id: string;
        flashcardId: string;
      }[];
    },
    cardTexts: Map<string, { term: string; definition: string }>,
  ): TestQuestionDto {
    const base = {
      questionAttemptId: q.id,
      flashcardId: q.flashcardId,
      questionType: q.questionType,
      answerDirection: q.answerDirection,
      promptText: q.promptText,
      orderIndex: q.orderIndex,
    };

    if (q.questionType === TestQuestionType.TEST_MC) {
      return plainToInstance(
        TestQuestionDto,
        { ...base, choices: q.choices },
        { excludeExtraneousValues: true },
      );
    }
    if (q.questionType === TestQuestionType.TEST_TF) {
      // The single presented candidate (correct or decoy) lives in
      // choices[0] — hoist to a friendlier top-level field.
      return plainToInstance(
        TestQuestionDto,
        { ...base, tfPresentedAnswer: q.choices[0] ?? '' },
        { excludeExtraneousValues: true },
      );
    }
    if (q.questionType === TestQuestionType.TEST_MATCH) {
      return plainToInstance(
        TestQuestionDto,
        {
          ...base,
          matchingPairs: this.buildMatchingPairDtos(q, cardTexts),
        },
        { excludeExtraneousValues: true },
      );
    }
    // TEST_WRITTEN
    return plainToInstance(TestQuestionDto, base, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Build the presented matching grid. Anchor text = prompt side of
   * the card under the resolved direction; candidate text = answer
   * side. Candidate texts are shuffled independently of anchor order
   * so the correct pairing isn't just row-by-row.
   */
  private buildMatchingPairDtos(
    q: {
      answerDirection: LearnAnswerDirection;
      matchingPairs: { id: string; flashcardId: string }[];
    },
    cardTexts: Map<string, { term: string; definition: string }>,
  ): TestMatchingPairDto[] {
    const promptSide =
      q.answerDirection === LearnAnswerDirection.DEFINITION_TO_TERM
        ? 'definition'
        : 'term';
    const answerSide = promptSide === 'term' ? 'definition' : 'term';

    // Build anchor + candidate arrays. Anchors stay in DB order so
    // pairIds map cleanly; candidates get shuffled so a naive
    // "match row 1 with row 1" heuristic fails.
    const anchors = q.matchingPairs.map((p) => {
      const card = cardTexts.get(p.flashcardId);
      return {
        pairId: p.id,
        flashcardId: p.flashcardId,
        anchorText: card ? card[promptSide] : '',
      };
    });
    const candidates = shuffle(
      q.matchingPairs.map((p) => {
        const card = cardTexts.get(p.flashcardId);
        return {
          flashcardId: p.flashcardId,
          text: card ? card[answerSide] : '',
        };
      }),
    );

    return anchors.map((anchor, i) =>
      plainToInstance(
        TestMatchingPairDto,
        {
          pairId: anchor.pairId,
          flashcardId: anchor.flashcardId,
          anchorText: anchor.anchorText,
          candidateText: candidates[i]?.text ?? '',
        },
        { excludeExtraneousValues: true },
      ),
    );
  }

  /** Every flashcard id referenced by an attempt — question anchors
   *  + matching pair anchors. Used to pre-load texts for matching. */
  private collectFlashcardIds(
    questions: {
      flashcardId: string;
      matchingPairs: { flashcardId: string }[];
    }[],
  ): string[] {
    const ids = new Set<string>();
    for (const q of questions) {
      ids.add(q.flashcardId);
      for (const p of q.matchingPairs) ids.add(p.flashcardId);
    }
    return Array.from(ids);
  }

  private async loadCardTexts(
    ids: readonly string[],
  ): Promise<Map<string, { term: string; definition: string }>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.flashcard.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, term: true, definition: true },
    });
    return new Map(
      rows.map((r) => [r.id, { term: r.term, definition: r.definition }]),
    );
  }

  private buildResultResponse(
    attempt: Prisma.TestAttemptGetPayload<{
      include: {
        testQuestionAttempts: {
          include: { matchingPairs: true };
        };
      };
    }>,
  ): TestAttemptResultDto {
    const questions: TestQuestionResultDto[] = attempt.testQuestionAttempts.map(
      (q) =>
        plainToInstance(
          TestQuestionResultDto,
          {
            questionAttemptId: q.id,
            flashcardId: q.flashcardId,
            questionType: q.questionType,
            answerDirection: q.answerDirection,
            promptText: q.promptText,
            expectedAnswer: q.expectedAnswer,
            choices: q.choices,
            correctChoiceIndex: q.correctChoiceIndex,
            userAnswer: q.userAnswer,
            selectedChoiceIndex: q.selectedChoiceIndex,
            similarity:
              q.similarity !== null && q.similarity !== undefined
                ? Number(q.similarity)
                : null,
            isCorrect: q.isCorrect,
            orderIndex: q.orderIndex,
            pairs:
              q.questionType === TestQuestionType.TEST_MATCH
                ? q.matchingPairs.map((p) =>
                    plainToInstance(
                      TestPairResultDto,
                      {
                        pairId: p.id,
                        flashcardId: p.flashcardId,
                        userMatchedFlashcardId: p.userMatchedFlashcardId,
                        isCorrect: p.isCorrect,
                      },
                      { excludeExtraneousValues: true },
                    ),
                  )
                : undefined,
          },
          { excludeExtraneousValues: true },
        ),
    );

    return plainToInstance(
      TestAttemptResultDto,
      {
        attemptId: attempt.id,
        studySetId: attempt.studySetId,
        status: attempt.status,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        correctCount: attempt.correctCount,
        incorrectCount: attempt.incorrectCount,
        questionCount: attempt.questionCount,
        durationSeconds: attempt.durationSeconds,
        createdAt: attempt.createdAt,
        submittedAt: attempt.submittedAt,
        questions,
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * SRS §9.4 grading map. GOOD on correct, AGAIN on incorrect. Keeps
   * the Test path simple and audit-clean — the more nuanced
   * deriveRating() from Learn Mode uses hint / responseMs / similarity
   * signals that Test doesn't collect at this granularity.
   */
  private ratingFor(isCorrect: boolean): Sm2Rating {
    return isCorrect ? 'GOOD' : 'AGAIN';
  }
}
