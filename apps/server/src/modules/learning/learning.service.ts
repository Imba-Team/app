import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CardMasteryStatus,
  Prisma,
  StudySession,
  StudySessionMode,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { Redis } from 'ioredis';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { REDIS_CLIENT } from 'src/common/redis/redis.constants';
import { StudySetService } from 'src/modules/study-set/study-set.service';

import { StartSessionDto } from './dtos/start-session.dto';
import { StartSessionResponseDto } from './dtos/start-session-response.dto';
import { SubmitAnswerDto } from './dtos/submit-answer.dto';
import {
  AnswerResponseDto,
  CardProgressSummaryDto,
  SetProgressSummaryDto,
} from './dtos/answer-response.dto';
import { ListSessionsQueryDto } from './dtos/list-sessions-query.dto';
import { SessionHistoryItemDto } from './dtos/session-history-item.dto';
import { SessionSummaryDto } from './dtos/session-summary.dto';
import {
  ApplyResult,
  NEW_PROGRESS,
  ProgressState,
  applyAttempt,
} from './domain/apply-attempt';
import { AttemptOutcome, StudyMode } from './domain/card-attempt-event';
import { shuffle } from './domain/shuffle';
import { granularToCoarse } from './domain/study-mode-mapper';
import { evaluateWrittenAnswer } from './domain/write-evaluator';
import { SubmitWrittenAnswerDto } from './dtos/submit-written-answer.dto';
import {
  WriteEvaluationDto,
  WrittenAnswerResponseDto,
} from './dtos/written-answer-response.dto';
import {
  LearnBatchCardDto,
  LearnBatchResponseDto,
  LearnPromptType,
} from './dtos/learn-batch-response.dto';

const IDEMPOTENCY_TTL_SECONDS = 300;
const SET_PROGRESS_CACHE_TTL_SECONDS = 300;

interface AnswerRawResult {
  correct: boolean;
  correctAnswer: string;
  graduated: boolean;
  demoted: boolean;
  cardProgress: {
    status: CardMasteryStatus;
    weightedStreak: string;
    correctCount: number;
    incorrectCount: number;
    masteredAt: Date | null;
  };
  setProgress: {
    totalCards: number;
    newCount: number;
    learningCount: number;
    masteredCount: number;
  };
}

/**
 * How long a not-yet-completed session may sit around before it counts
 * as "abandoned" and is swept from history. Sessions younger than this
 * remain visible in the history list with a "Resume" affordance.
 */
export const SESSION_RESUME_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class LearningService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Delete this user's abandoned sessions — never completed and older
   * than the resume window. Cheap: indexed by userId and completedAt.
   * Called opportunistically from listSessions so history stays free
   * of noise from "started a mode, closed the tab" interactions.
   *
   * Per-card answers were persisted directly against UserCardProgress,
   * so mastery isn't affected by dropping the session shell.
   */
  private async sweepAbandonedSessions(userId: string): Promise<void> {
    const cutoff = new Date(Date.now() - SESSION_RESUME_WINDOW_MS);
    const deleted = await this.prisma.studySession.deleteMany({
      where: {
        userId,
        completedAt: null,
        startedAt: { lt: cutoff },
      },
    });
    if (deleted.count > 0) {
      this.logger.debug(
        `Swept ${deleted.count} abandoned session(s) for userId=${userId}`,
      );
    }
  }

  async startSession(
    userId: string,
    dto: StartSessionDto,
  ): Promise<StartSessionResponseDto> {
    const canAccess = await this.studySetService.canAccess(
      userId,
      dto.studySetId,
    );
    if (!canAccess) throw new ForbiddenException('Study set is private');

    const session = await this.prisma.studySession.create({
      data: {
        userId,
        studySetId: dto.studySetId,
        mode: dto.mode,
        startedAt: new Date(),
      },
    });

    this.logger.log(
      `Session started: id=${session.id}, userId=${userId}, setId=${dto.studySetId}, mode=${dto.mode}`,
    );

    return plainToInstance(
      StartSessionResponseDto,
      {
        sessionId: session.id,
        studySetId: session.studySetId,
        mode: session.mode,
        startedAt: session.startedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  async submitAnswer(
    userId: string,
    sessionId: string,
    dto: SubmitAnswerDto,
  ): Promise<AnswerResponseDto> {
    const cached = await this.readIdempotentResponse<AnswerResponseDto>(
      dto.attemptId,
      AnswerResponseDto,
    );
    if (cached) return cached;

    const { session, card } = await this.loadSessionAndCard(
      userId,
      sessionId,
      dto.cardId,
    );

    const raw = await this.applyAndPersistAnswer(userId, session, card, {
      attemptId: dto.attemptId,
      studyMode: dto.studyMode,
      outcome: dto.outcome,
      hintUsed: dto.hintUsed,
    });

    const response = plainToInstance(
      AnswerResponseDto,
      {
        ...raw,
        cardProgress: plainToInstance(
          CardProgressSummaryDto,
          raw.cardProgress,
          { excludeExtraneousValues: true },
        ),
        setProgress: plainToInstance(SetProgressSummaryDto, raw.setProgress, {
          excludeExtraneousValues: true,
        }),
      },
      { excludeExtraneousValues: true },
    );

    await this.storeIdempotentResponse(dto.attemptId, response);
    return response;
  }

  async evaluateAndSubmitWritten(
    userId: string,
    sessionId: string,
    dto: SubmitWrittenAnswerDto,
  ): Promise<WrittenAnswerResponseDto> {
    const cached = await this.readIdempotentResponse<WrittenAnswerResponseDto>(
      dto.attemptId,
      WrittenAnswerResponseDto,
    );
    if (cached) return cached;

    const { session, card } = await this.loadSessionAndCard(
      userId,
      sessionId,
      dto.cardId,
    );

    const evaluation = evaluateWrittenAnswer(dto.userAnswer, card.definition);

    const raw = await this.applyAndPersistAnswer(userId, session, card, {
      attemptId: dto.attemptId,
      studyMode: dto.studyMode,
      outcome: evaluation.outcome,
      hintUsed: dto.hintUsed,
    });

    const response = plainToInstance(
      WrittenAnswerResponseDto,
      {
        ...raw,
        cardProgress: plainToInstance(
          CardProgressSummaryDto,
          raw.cardProgress,
          { excludeExtraneousValues: true },
        ),
        setProgress: plainToInstance(SetProgressSummaryDto, raw.setProgress, {
          excludeExtraneousValues: true,
        }),
        evaluation: plainToInstance(
          WriteEvaluationDto,
          {
            matchType: evaluation.matchType,
            similarity: Number(evaluation.similarity.toFixed(4)),
            editDistance: evaluation.editDistance,
            normalizedInput: evaluation.normalizedInput,
            normalizedExpected: evaluation.normalizedExpected,
          },
          { excludeExtraneousValues: true },
        ),
      },
      { excludeExtraneousValues: true },
    );

    await this.storeIdempotentResponse(dto.attemptId, response);
    return response;
  }

  private async loadSessionAndCard(
    userId: string,
    sessionId: string,
    cardId: string,
  ): Promise<{
    session: StudySession;
    card: { id: string; studySetId: string; definition: string };
  }> {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId)
      throw new ForbiddenException('Not your session');
    if (session.completedAt)
      throw new ConflictException('Session already completed');

    const card = await this.prisma.flashcard.findUnique({
      where: { id: cardId },
      select: { id: true, studySetId: true, definition: true },
    });
    if (!card) throw new NotFoundException('Flashcard not found');
    if (card.studySetId !== session.studySetId) {
      throw new ConflictException("Card does not belong to this session's set");
    }
    return { session, card };
  }

  private async applyAndPersistAnswer(
    userId: string,
    session: StudySession,
    card: { id: string; studySetId: string; definition: string },
    event: {
      attemptId: string;
      studyMode: StudyMode;
      outcome: AttemptOutcome;
      hintUsed: boolean;
    },
  ): Promise<AnswerRawResult> {
    const raw = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userCardProgress.findUnique({
        where: { userId_cardId: { userId, cardId: card.id } },
      });

      const prevState: ProgressState = existing
        ? {
            status: existing.status,
            weightedStreak: Number(existing.weightedStreak),
            correctCount: existing.correctCount,
            incorrectCount: existing.incorrectCount,
            hintsUsedCount: existing.hintsUsedCount,
            timesDemoted: existing.timesDemoted,
            masteredAt: existing.masteredAt,
          }
        : NEW_PROGRESS;
      const prevStatusForDelta: CardMasteryStatus = existing
        ? existing.status
        : CardMasteryStatus.NEW;

      const result: ApplyResult = applyAttempt(prevState, {
        attemptId: event.attemptId,
        userId,
        cardId: card.id,
        setId: card.studySetId,
        sessionId: session.id,
        studyMode: event.studyMode,
        outcome: event.outcome,
        hintUsed: event.hintUsed,
        attemptedAt: new Date(),
      });

      const cardWrite = {
        status: result.next.status,
        weightedStreak: new Prisma.Decimal(
          result.next.weightedStreak.toFixed(2),
        ),
        correctCount: result.next.correctCount,
        incorrectCount: result.next.incorrectCount,
        hintsUsedCount: result.next.hintsUsedCount,
        timesDemoted: result.next.timesDemoted,
        masteredAt: result.next.masteredAt,
        lastStudyMode: granularToCoarse(event.studyMode),
        lastAttemptedAt: new Date(),
      };

      const persistedCard = await tx.userCardProgress.upsert({
        where: { userId_cardId: { userId, cardId: card.id } },
        create: {
          userId,
          cardId: card.id,
          setId: card.studySetId,
          ...cardWrite,
        },
        update: cardWrite,
      });

      const setProgress = await this.applySetProgressDelta(
        tx,
        userId,
        card.studySetId,
        prevStatusForDelta,
        result.next.status,
        existing !== null,
      );

      if (result.graduated) {
        await tx.srsCard.upsert({
          where: { userId_cardId: { userId, cardId: card.id } },
          create: { userId, cardId: card.id },
          update: {},
        });
      }

      if (event.outcome !== 'SKIPPED') {
        await tx.studySession.update({
          where: { id: session.id },
          data: {
            cardsStudied: { increment: 1 },
            correctAnswers:
              event.outcome === 'CORRECT' ? { increment: 1 } : undefined,
            incorrectAnswers:
              event.outcome === 'INCORRECT' ? { increment: 1 } : undefined,
          },
        });
      }

      return {
        correct: event.outcome === 'CORRECT',
        correctAnswer: card.definition,
        graduated: result.graduated,
        demoted: result.demoted,
        cardProgress: {
          status: persistedCard.status,
          weightedStreak: persistedCard.weightedStreak.toString(),
          correctCount: persistedCard.correctCount,
          incorrectCount: persistedCard.incorrectCount,
          masteredAt: persistedCard.masteredAt,
        },
        setProgress: {
          totalCards: setProgress.totalCards,
          newCount: setProgress.newCount,
          learningCount: setProgress.learningCount,
          masteredCount: setProgress.masteredCount,
        },
      };
    });

    await this.invalidateSetProgressCache(userId, card.studySetId);

    if (raw.graduated) {
      this.logger.log(
        `Card graduated to MASTERED: userId=${userId}, cardId=${card.id}`,
      );
    } else if (raw.demoted) {
      this.logger.log(
        `Card demoted from MASTERED: userId=${userId}, cardId=${card.id}`,
      );
    }

    return raw;
  }

  async completeSession(
    userId: string,
    sessionId: string,
  ): Promise<SessionSummaryDto> {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId)
      throw new ForbiddenException('Not your session');

    let completed = session;
    if (!session.completedAt) {
      const completedAt = new Date();
      const durationSeconds = Math.max(
        0,
        Math.floor(
          (completedAt.getTime() - session.startedAt.getTime()) / 1000,
        ),
      );
      completed = await this.prisma.studySession.update({
        where: { id: sessionId },
        data: { completedAt, durationSeconds },
      });
      this.logger.log(
        `Session completed: id=${sessionId}, durationSeconds=${durationSeconds}`,
      );
    }

    const answered = completed.correctAnswers + completed.incorrectAnswers;
    const accuracy = answered > 0 ? completed.correctAnswers / answered : 0;

    return plainToInstance(
      SessionSummaryDto,
      {
        sessionId: completed.id,
        studySetId: completed.studySetId,
        mode: completed.mode,
        cardsStudied: completed.cardsStudied,
        correctAnswers: completed.correctAnswers,
        incorrectAnswers: completed.incorrectAnswers,
        durationSeconds: completed.durationSeconds,
        accuracy: Number(accuracy.toFixed(4)),
        startedAt: completed.startedAt,
        completedAt: completed.completedAt as Date,
      },
      { excludeExtraneousValues: true },
    );
  }

  async listSessions(
    userId: string,
    query: ListSessionsQueryDto,
  ): Promise<{
    items: SessionHistoryItemDto[];
    total: number;
    limit: number;
    offset: number;
  }> {
    // Sweep abandoned sessions — started but never completed and older
    // than the resume window (5 min). Individual per-card answers were
    // already recorded against UserCardProgress at submission time, so
    // the learner's mastery isn't lost by dropping the session shell.
    // Keeps the history free of noise from "start mode, close tab"
    // interactions while still letting the learner resume a session
    // they left seconds ago.
    await this.sweepAbandonedSessions(userId);

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const where: Prisma.StudySessionWhereInput = {
      userId,
      ...(query.studySetId ? { studySetId: query.studySetId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.studySession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.studySession.count({ where }),
    ]);

    const items = rows.map((row) => {
      const answered = row.correctAnswers + row.incorrectAnswers;
      const accuracy = answered > 0 ? row.correctAnswers / answered : 0;
      return plainToInstance(
        SessionHistoryItemDto,
        {
          sessionId: row.id,
          studySetId: row.studySetId,
          mode: row.mode,
          cardsStudied: row.cardsStudied,
          correctAnswers: row.correctAnswers,
          incorrectAnswers: row.incorrectAnswers,
          durationSeconds: row.durationSeconds,
          accuracy: Number(accuracy.toFixed(4)),
          startedAt: row.startedAt,
          completedAt: row.completedAt,
        },
        { excludeExtraneousValues: true },
      );
    });

    return { items, total, limit, offset };
  }

  async getNextBatch(
    userId: string,
    sessionId: string,
    size: number,
  ): Promise<LearnBatchResponseDto> {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId)
      throw new ForbiddenException('Not your session');
    if (session.completedAt)
      throw new ConflictException('Session already completed');
    if (session.mode !== StudySessionMode.LEARN) {
      throw new ConflictException(
        `next-batch is only supported on LEARN sessions (session mode: ${session.mode})`,
      );
    }

    const cards = await this.prisma.flashcard.findMany({
      where: { studySetId: session.studySetId },
      select: { id: true, term: true, definition: true, hint: true },
      orderBy: { orderIndex: 'asc' },
    });
    if (cards.length === 0) {
      return plainToInstance(
        LearnBatchResponseDto,
        { sessionId, cards: [], hasMoreCards: false },
        { excludeExtraneousValues: true },
      );
    }

    const progressRows = await this.prisma.userCardProgress.findMany({
      where: { userId, cardId: { in: cards.map((c) => c.id) } },
    });
    const progressByCardId = new Map(progressRows.map((r) => [r.cardId, r]));

    const nonMastered = cards.filter((c) => {
      const p = progressByCardId.get(c.id);
      return !p || p.status !== CardMasteryStatus.MASTERED;
    });
    if (nonMastered.length === 0) {
      return plainToInstance(
        LearnBatchResponseDto,
        { sessionId, cards: [], hasMoreCards: false },
        { excludeExtraneousValues: true },
      );
    }

    const learning = nonMastered.filter(
      (c) => progressByCardId.get(c.id)?.status === CardMasteryStatus.LEARNING,
    );
    const fresh = nonMastered.filter(
      (c) => progressByCardId.get(c.id)?.status !== CardMasteryStatus.LEARNING,
    );
    const ordered = [...shuffle(learning), ...shuffle(fresh)];
    const selected = ordered.slice(0, size);

    const batchCards: LearnBatchCardDto[] = selected.map((card) => {
      const progress = progressByCardId.get(card.id);
      const streak = progress ? Number(progress.weightedStreak) : 0;

      const distractorPool = Array.from(
        new Set(
          cards
            .filter(
              (other) =>
                other.id !== card.id && other.definition !== card.definition,
            )
            .map((other) => other.definition),
        ),
      );

      const canRenderMC = distractorPool.length >= 3;
      const promptType: LearnPromptType =
        canRenderMC && streak < 1.0 ? 'LEARN_MC' : 'LEARN_WRITTEN';

      if (promptType === 'LEARN_WRITTEN') {
        return {
          cardId: card.id,
          term: card.term,
          hint: card.hint,
          promptType,
        };
      }

      const distractors = shuffle(distractorPool).slice(0, 3);
      const choices = shuffle([card.definition, ...distractors]);
      return {
        cardId: card.id,
        term: card.term,
        hint: card.hint,
        promptType,
        choices,
        correctChoiceIndex: choices.indexOf(card.definition),
      };
    });

    return plainToInstance(
      LearnBatchResponseDto,
      {
        sessionId,
        cards: batchCards,
        hasMoreCards: nonMastered.length > selected.length,
      },
      { excludeExtraneousValues: true },
    );
  }

  async getSetProgress(
    userId: string,
    setId: string,
  ): Promise<SetProgressSummaryDto> {
    const canAccess = await this.studySetService.canAccess(userId, setId);
    if (!canAccess) throw new ForbiddenException('Study set is private');

    const cacheKey = this.setProgressCacheKey(userId, setId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as SetProgressSummaryDto;
        return plainToInstance(SetProgressSummaryDto, parsed, {
          excludeExtraneousValues: true,
        });
      } catch (err) {
        this.logger.warn(
          `Invalid set-progress cache entry for ${cacheKey}, ignoring: ${(err as Error).message}`,
        );
      }
    }

    let row = await this.prisma.userSetProgress.findUnique({
      where: { userId_setId: { userId, setId } },
    });

    if (!row) {
      const totalCards = await this.prisma.flashcard.count({
        where: { studySetId: setId },
      });
      row = {
        userId,
        setId,
        totalCards,
        newCount: totalCards,
        learningCount: 0,
        masteredCount: 0,
        lastStudiedAt: null,
        updatedAt: new Date(),
      };
    }

    const dto = plainToInstance(
      SetProgressSummaryDto,
      {
        totalCards: row.totalCards,
        newCount: row.newCount,
        learningCount: row.learningCount,
        masteredCount: row.masteredCount,
      },
      { excludeExtraneousValues: true },
    );

    await this.redis.set(
      cacheKey,
      JSON.stringify(dto),
      'EX',
      SET_PROGRESS_CACHE_TTL_SECONDS,
    );

    return dto;
  }

  /**
   * Clear the caller's mastery + SRS state for a set. Wipes UserCardProgress,
   * UserSetProgress, and SrsCard rows for every card in the set. Study-session
   * history and the append-only attempt log are preserved — reset is a
   * learner-facing "start over", not a delete-my-analytics.
   */
  async resetSetProgress(userId: string, setId: string): Promise<void> {
    const canAccess = await this.studySetService.canAccess(userId, setId);
    if (!canAccess) throw new ForbiddenException('Study set is private');

    await this.prisma.$transaction([
      this.prisma.userCardProgress.deleteMany({
        where: { userId, setId },
      }),
      this.prisma.srsCard.deleteMany({
        where: {
          userId,
          card: { studySetId: setId },
        },
      }),
      this.prisma.userSetProgress.deleteMany({
        where: { userId, setId },
      }),
    ]);
    await this.redis.del(this.setProgressCacheKey(userId, setId));

    this.logger.log(`Set progress reset: userId=${userId}, setId=${setId}`);
  }

  private setProgressCacheKey(userId: string, setId: string): string {
    return `learning:set-progress:${userId}:${setId}`;
  }

  private async applySetProgressDelta(
    tx: Prisma.TransactionClient,
    userId: string,
    setId: string,
    prev: CardMasteryStatus,
    next: CardMasteryStatus,
    hadExistingRow: boolean,
  ): Promise<{
    totalCards: number;
    newCount: number;
    learningCount: number;
    masteredCount: number;
  }> {
    let row = await tx.userSetProgress.findUnique({
      where: { userId_setId: { userId, setId } },
    });

    if (!row) {
      const totalCards = await tx.flashcard.count({
        where: { studySetId: setId },
      });
      row = await tx.userSetProgress.create({
        data: {
          userId,
          setId,
          totalCards,
          newCount: totalCards,
          learningCount: 0,
          masteredCount: 0,
          lastStudiedAt: new Date(),
        },
      });
    }

    // Treat a card with no prior progress row as `NEW` — that's already the
    // seed count baked into UserSetProgress at initialization, so we only
    // decrement `newCount` when transitioning out of NEW for the first time.
    const effectivePrev: CardMasteryStatus = hadExistingRow
      ? prev
      : CardMasteryStatus.NEW;

    if (effectivePrev === next) {
      const updated = await tx.userSetProgress.update({
        where: { userId_setId: { userId, setId } },
        data: { lastStudiedAt: new Date() },
      });
      return updated;
    }

    const delta: Record<CardMasteryStatus, number> = {
      NEW: 0,
      LEARNING: 0,
      MASTERED: 0,
    };
    delta[effectivePrev] -= 1;
    delta[next] += 1;

    const updated = await tx.userSetProgress.update({
      where: { userId_setId: { userId, setId } },
      data: {
        newCount: { increment: delta.NEW },
        learningCount: { increment: delta.LEARNING },
        masteredCount: { increment: delta.MASTERED },
        lastStudiedAt: new Date(),
      },
    });

    return updated;
  }

  private idempotencyKey(attemptId: string): string {
    return `learning:attempt:${attemptId}`;
  }

  private async readIdempotentResponse<T>(
    attemptId: string,
    cls: new () => T,
  ): Promise<T | null> {
    const raw = await this.redis.get(this.idempotencyKey(attemptId));
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return plainToInstance(cls, parsed, { excludeExtraneousValues: true });
    } catch (err) {
      this.logger.warn(
        `Invalid idempotency cache entry for attemptId=${attemptId}, ignoring: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async storeIdempotentResponse(
    attemptId: string,
    response: unknown,
  ): Promise<void> {
    await this.redis.set(
      this.idempotencyKey(attemptId),
      JSON.stringify(response),
      'EX',
      IDEMPOTENCY_TTL_SECONDS,
    );
  }

  private async invalidateSetProgressCache(
    userId: string,
    setId: string,
  ): Promise<void> {
    await this.redis.del(this.setProgressCacheKey(userId, setId));
  }
}
