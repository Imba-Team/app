import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CardMasteryStatus, Prisma } from '@prisma/client';
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
import { SessionSummaryDto } from './dtos/session-summary.dto';
import {
  ApplyResult,
  NEW_PROGRESS,
  ProgressState,
  applyAttempt,
} from './domain/apply-attempt';
import { granularToCoarse } from './domain/study-mode-mapper';

const IDEMPOTENCY_TTL_SECONDS = 300;
const SET_PROGRESS_CACHE_TTL_SECONDS = 300;

@Injectable()
export class LearningService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

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
    const cached = await this.readIdempotentResponse(dto.attemptId);
    if (cached) return cached;

    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId)
      throw new ForbiddenException('Not your session');
    if (session.completedAt)
      throw new ConflictException('Session already completed');

    const card = await this.prisma.flashcard.findUnique({
      where: { id: dto.cardId },
      select: { id: true, studySetId: true, definition: true },
    });
    if (!card) throw new NotFoundException('Flashcard not found');
    if (card.studySetId !== session.studySetId) {
      throw new ConflictException("Card does not belong to this session's set");
    }

    const response = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userCardProgress.findUnique({
        where: { userId_cardId: { userId, cardId: dto.cardId } },
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
        attemptId: dto.attemptId,
        userId,
        cardId: dto.cardId,
        setId: card.studySetId,
        sessionId,
        studyMode: dto.studyMode,
        outcome: dto.outcome,
        hintUsed: dto.hintUsed,
        attemptedAt: new Date(),
      });

      const persistedCard = await tx.userCardProgress.upsert({
        where: { userId_cardId: { userId, cardId: dto.cardId } },
        create: {
          userId,
          cardId: dto.cardId,
          setId: card.studySetId,
          status: result.next.status,
          weightedStreak: new Prisma.Decimal(
            result.next.weightedStreak.toFixed(2),
          ),
          correctCount: result.next.correctCount,
          incorrectCount: result.next.incorrectCount,
          hintsUsedCount: result.next.hintsUsedCount,
          timesDemoted: result.next.timesDemoted,
          masteredAt: result.next.masteredAt,
          lastStudyMode: granularToCoarse(dto.studyMode),
          lastAttemptedAt: new Date(),
        },
        update: {
          status: result.next.status,
          weightedStreak: new Prisma.Decimal(
            result.next.weightedStreak.toFixed(2),
          ),
          correctCount: result.next.correctCount,
          incorrectCount: result.next.incorrectCount,
          hintsUsedCount: result.next.hintsUsedCount,
          timesDemoted: result.next.timesDemoted,
          masteredAt: result.next.masteredAt,
          lastStudyMode: granularToCoarse(dto.studyMode),
          lastAttemptedAt: new Date(),
        },
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
          where: { userId_cardId: { userId, cardId: dto.cardId } },
          create: {
            userId,
            cardId: dto.cardId,
          },
          update: {},
        });
      }

      if (dto.outcome !== 'SKIPPED') {
        await tx.studySession.update({
          where: { id: sessionId },
          data: {
            cardsStudied: { increment: 1 },
            correctAnswers:
              dto.outcome === 'CORRECT' ? { increment: 1 } : undefined,
            incorrectAnswers:
              dto.outcome === 'INCORRECT' ? { increment: 1 } : undefined,
          },
        });
      }

      return {
        correct: dto.outcome === 'CORRECT',
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

    const dto_ = plainToInstance(
      AnswerResponseDto,
      {
        ...response,
        cardProgress: plainToInstance(
          CardProgressSummaryDto,
          response.cardProgress,
          {
            excludeExtraneousValues: true,
          },
        ),
        setProgress: plainToInstance(
          SetProgressSummaryDto,
          response.setProgress,
          {
            excludeExtraneousValues: true,
          },
        ),
      },
      { excludeExtraneousValues: true },
    );

    await this.storeIdempotentResponse(dto.attemptId, dto_);

    if (response.graduated) {
      this.logger.log(
        `Card graduated to MASTERED: userId=${userId}, cardId=${dto.cardId}`,
      );
    } else if (response.demoted) {
      this.logger.log(
        `Card demoted from MASTERED: userId=${userId}, cardId=${dto.cardId}`,
      );
    }

    return dto_;
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

  private async readIdempotentResponse(
    attemptId: string,
  ): Promise<AnswerResponseDto | null> {
    const raw = await this.redis.get(this.idempotencyKey(attemptId));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as AnswerResponseDto;
      return plainToInstance(AnswerResponseDto, parsed, {
        excludeExtraneousValues: true,
      });
    } catch (err) {
      this.logger.warn(
        `Invalid idempotency cache entry for attemptId=${attemptId}, ignoring: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async storeIdempotentResponse(
    attemptId: string,
    response: AnswerResponseDto,
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
