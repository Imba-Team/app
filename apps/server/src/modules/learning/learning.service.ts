import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptOutcomeStatus,
  CardMasteryStatus,
  LearnAnswerDirection,
  Prisma,
  StudySession,
  StudySessionMode,
  StudySessionStatus,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { Redis } from 'ioredis';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { REDIS_CLIENT } from 'src/common/redis/redis.constants';
import { StudySetService } from 'src/modules/study-set/study-set.service';
import { SetPreferencesService } from 'src/modules/set-preferences/set-preferences.service';
import { SetPreferencesResponseDto } from 'src/modules/set-preferences/dtos/set-preferences-response.dto';
import { SrsService } from 'src/modules/srs/srs.service';

import { InflightSessionResponseDto } from './dtos/inflight-session-response.dto';
import { MarkCorrectDto } from './dtos/mark-correct.dto';
import { PauseSessionDto } from './dtos/pause-session.dto';
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
import { deriveRating } from './domain/derive-rating';
import { MODE_WEIGHT } from './domain/mode-weights';
import { pickDistractors } from './domain/pick-distractors';
import {
  selectPromptType,
  type RecentAttempt,
} from './domain/select-prompt-type';
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

/**
 * A session that hasn't been touched (answered / paused / resumed) in
 * this long is auto-marked ABANDONED. Cheap: indexed on lastActivityAt
 * via the (userId, studySetId, mode, status) composite lookup.
 */
export const SESSION_ABANDON_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

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

@Injectable()
export class LearningService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
    private readonly setPreferencesService: SetPreferencesService,
    private readonly srsService: SrsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Mark long-idle ACTIVE/PAUSED sessions as ABANDONED. The learner's
   * per-card mastery is untouched — CardAttempt rows and
   * UserCardProgress persist independently — but the session shell
   * stops appearing as "in-flight" so a Resume prompt can't lure the
   * learner back into a stale batch. Called opportunistically from
   * listSessions and getInflightSession.
   */
  private async sweepAbandonedSessions(userId: string): Promise<void> {
    const cutoff = new Date(Date.now() - SESSION_ABANDON_AFTER_MS);
    const updated = await this.prisma.studySession.updateMany({
      where: {
        userId,
        status: { in: [StudySessionStatus.ACTIVE, StudySessionStatus.PAUSED] },
        lastActivityAt: { lt: cutoff },
      },
      data: { status: StudySessionStatus.ABANDONED },
    });
    if (updated.count > 0) {
      this.logger.debug(
        `Marked ${updated.count} session(s) ABANDONED for userId=${userId}`,
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

    // Concurrent-session guard: if the learner already has an ACTIVE
    // or PAUSED session for this (set, mode), return that one instead
    // of stacking a duplicate. Prevents accidental double-starts from
    // rapid clicks or tab reopens; the frontend still calls
    // getInflightSession first to render the Resume dialog, this is a
    // safety net for the POST path.
    const existing = await this.prisma.studySession.findFirst({
      where: {
        userId,
        studySetId: dto.studySetId,
        mode: dto.mode,
        status: { in: [StudySessionStatus.ACTIVE, StudySessionStatus.PAUSED] },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
    if (existing) {
      this.logger.log(
        `Session resumed via startSession: id=${existing.id}, userId=${userId}, setId=${dto.studySetId}, mode=${dto.mode}`,
      );
      return plainToInstance(
        StartSessionResponseDto,
        {
          sessionId: existing.id,
          studySetId: existing.studySetId,
          mode: existing.mode,
          status: existing.status,
          resumed: true,
          startedAt: existing.startedAt,
        },
        { excludeExtraneousValues: true },
      );
    }

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
        status: session.status,
        resumed: false,
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
      responseMs: dto.responseMs,
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

    // Direction + strictness both come from the caller's per-set
    // preferences. In reverse mode the expected side flips to the
    // term and alternateAnswers are ignored — those synonyms belong
    // to the definition and don't apply when the learner types the
    // term instead.
    const preferences = await this.setPreferencesService.getForCaller(
      userId,
      card.studySetId,
    );
    const isReverse =
      preferences.answerDirection === LearnAnswerDirection.DEFINITION_TO_TERM;
    const expected = isReverse ? card.term : card.definition;
    const alternates = isReverse ? [] : card.alternateAnswers;

    const evaluation = evaluateWrittenAnswer(
      dto.userAnswer,
      expected,
      alternates,
      preferences.strictness,
    );

    const raw = await this.applyAndPersistAnswer(userId, session, card, {
      attemptId: dto.attemptId,
      studyMode: dto.studyMode,
      outcome: evaluation.outcome,
      hintUsed: dto.hintUsed,
      responseMs: dto.responseMs,
      similarity: evaluation.similarity,
      editDistance: evaluation.editDistance,
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
            matchedAgainst: evaluation.matchedAgainst,
            diff: evaluation.diff,
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
    card: {
      id: string;
      studySetId: string;
      term: string;
      definition: string;
      alternateAnswers: string[];
    };
  }> {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId)
      throw new ForbiddenException('Not your session');
    if (
      session.status === StudySessionStatus.COMPLETED ||
      session.completedAt
    ) {
      throw new ConflictException('Session already completed');
    }
    if (session.status === StudySessionStatus.ABANDONED) {
      throw new ConflictException('Session was abandoned; start a new one');
    }
    // PAUSED sessions accept answers — that implicitly resumes them.
    // The upsert path bumps lastActivityAt and we flip status back to
    // ACTIVE at the same time so listSessions and the resume dialog
    // both agree on the state.
    if (session.status === StudySessionStatus.PAUSED) {
      await this.prisma.studySession.update({
        where: { id: session.id },
        data: { status: StudySessionStatus.ACTIVE },
      });
      session.status = StudySessionStatus.ACTIVE;
    }

    const card = await this.prisma.flashcard.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        studySetId: true,
        term: true,
        definition: true,
        alternateAnswers: true,
      },
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
    card: {
      id: string;
      studySetId: string;
      term?: string;
      definition: string;
      alternateAnswers?: string[];
    },
    event: {
      attemptId: string;
      studyMode: StudyMode;
      outcome: AttemptOutcome;
      hintUsed: boolean;
      responseMs?: number;
      similarity?: number;
      editDistance?: number;
    },
  ): Promise<AnswerRawResult> {
    const attemptedAt = new Date();
    const preferences = await this.setPreferencesService.getForCaller(
      userId,
      card.studySetId,
    );
    // Direction-aware "correct answer" text — reverse mode wants the
    // term, forward mode wants the definition. Falls back to definition
    // when the caller didn't project the term (older code paths).
    const correctAnswerText =
      preferences.answerDirection === LearnAnswerDirection.DEFINITION_TO_TERM
        ? (card.term ?? card.definition)
        : card.definition;
    const masteryConfig = {
      masteryThreshold: preferences.masteryThreshold,
      hintMultiplier: preferences.hintMultiplier,
    };
    // Load the user's local day boundary once so the review path
    // inside the transaction doesn't have to fire its own prisma read.
    const rating = deriveRating({
      outcome: event.outcome,
      hintUsed: event.hintUsed,
      studyMode: event.studyMode,
      similarity: event.similarity,
      responseMs: event.responseMs,
    });
    const today = rating
      ? await this.srsService.getUserDayStart(userId, attemptedAt)
      : null;

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

      const result: ApplyResult = applyAttempt(
        prevState,
        {
          attemptId: event.attemptId,
          userId,
          cardId: card.id,
          setId: card.studySetId,
          sessionId: session.id,
          studyMode: event.studyMode,
          outcome: event.outcome,
          hintUsed: event.hintUsed,
          attemptedAt,
          responseMs: event.responseMs,
          similarity: event.similarity,
          editDistance: event.editDistance,
        },
        attemptedAt,
        masteryConfig,
      );

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
        lastAttemptedAt: attemptedAt,
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

      // SRS: forward every scoring attempt to SM-2, not only graduation.
      // The old code created an SrsCard row exactly once (on graduation)
      // and never scheduled it — the schedule now moves with every
      // correct/incorrect answer, and the row is created lazily on
      // first review.
      if (rating && today) {
        await this.srsService.applyReviewByCard(
          tx,
          userId,
          card.id,
          rating,
          today,
          attemptedAt,
        );
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

      // Per-attempt audit log. Written for every submission — including
      // SKIPPED — so downstream analytics, adaptive prompt selection,
      // and session replay have the complete sequence.
      await tx.cardAttempt.create({
        data: {
          sessionId: session.id,
          userId,
          cardId: card.id,
          setId: card.studySetId,
          studyMode: event.studyMode,
          outcome: event.outcome,
          hintUsed: event.hintUsed,
          responseMs: event.responseMs,
          similarity:
            event.similarity !== undefined
              ? new Prisma.Decimal(event.similarity.toFixed(3))
              : null,
          editDistance: event.editDistance,
          createdAt: attemptedAt,
        },
      });

      return {
        correct: event.outcome === 'CORRECT',
        correctAnswer: correctAnswerText,
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
        data: {
          completedAt,
          durationSeconds,
          status: StudySessionStatus.COMPLETED,
          resumeState: Prisma.DbNull,
        },
      });
      // Belt-and-suspenders: invalidate the set-progress cache on
      // completion too. The answer path already invalidates on every
      // mutation, but a session that completed without any answered
      // cards (rare) would otherwise leave stale counts sitting in
      // Redis until TTL expiry.
      await this.invalidateSetProgressCache(userId, completed.studySetId);
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
          status: row.status,
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
    opts: { dueFirst?: boolean } = {},
  ): Promise<LearnBatchResponseDto> {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId)
      throw new ForbiddenException('Not your session');
    if (
      session.status === StudySessionStatus.COMPLETED ||
      session.completedAt
    ) {
      throw new ConflictException('Session already completed');
    }
    if (session.status === StudySessionStatus.ABANDONED) {
      throw new ConflictException('Session was abandoned; start a new one');
    }
    if (session.mode !== StudySessionMode.LEARN) {
      throw new ConflictException(
        `next-batch is only supported on LEARN sessions (session mode: ${session.mode})`,
      );
    }
    // A PAUSED session that asks for a batch implicitly resumes.
    // Symmetric with loadSessionAndCard so both entry points behave
    // the same way.
    if (session.status === StudySessionStatus.PAUSED) {
      await this.prisma.studySession.update({
        where: { id: session.id },
        data: { status: StudySessionStatus.ACTIVE },
      });
    }

    const preferences = await this.setPreferencesService.getForCaller(
      userId,
      session.studySetId,
    );
    const effectiveSize = Math.min(size, preferences.batchSize);
    // mcWrittenBias > 1 → flip to written sooner; < 1 → keep on MC
    // longer; 0 → never flip. Effective threshold is the point on the
    // weighted-streak axis at which the batch algorithm switches from
    // LEARN_MC to LEARN_WRITTEN. Guard against divide-by-zero.
    const writtenThreshold =
      preferences.mcWrittenBias > 0
        ? 1.0 / preferences.mcWrittenBias
        : Number.POSITIVE_INFINITY;

    // Direction-aware helpers — the "prompt" side is what the learner
    // sees, the "answer" side is what they must produce. In reverse
    // mode they swap; the MC distractor pool follows the answer side.
    const isReverse =
      preferences.answerDirection === LearnAnswerDirection.DEFINITION_TO_TERM;
    const promptOf = (c: { term: string; definition: string }) =>
      isReverse ? c.definition : c.term;
    const answerOf = (c: { term: string; definition: string }) =>
      isReverse ? c.term : c.definition;

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

    // Starred-only filter: reduce the working pool to cards the learner
    // has starred (UserCardProgress.isStarred). Cards without a progress
    // row are never starred, so the filter drops them naturally. When
    // the resulting pool is empty the frontend renders its own empty
    // state — we still return an empty batch here.
    const starredFiltered = preferences.starredOnly
      ? cards.filter((c) => progressByCardId.get(c.id)?.isStarred === true)
      : cards;

    // Due-first mode: pull SrsCard rows for this set and put cards
    // whose dueDate <= today at the front of the queue, in due-order.
    // Falls back through the usual learning/fresh mix once the due
    // pool is exhausted so the batch always fills. Restricted to
    // starred cards when the starred filter is active.
    const now = new Date();
    const dueCardIds: string[] = [];
    if (opts.dueFirst) {
      const today = await this.srsService.getUserDayStart(userId, now);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const starredIds = new Set(starredFiltered.map((c) => c.id));
      const dueSrs = await this.prisma.srsCard.findMany({
        where: {
          userId,
          card: { studySetId: session.studySetId },
          dueDate: { lt: tomorrow },
        },
        select: { cardId: true },
        orderBy: { dueDate: 'asc' },
      });
      for (const s of dueSrs) {
        if (starredIds.has(s.cardId)) dueCardIds.push(s.cardId);
      }
    }

    const nonMastered = starredFiltered.filter((c) => {
      const p = progressByCardId.get(c.id);
      return !p || p.status !== CardMasteryStatus.MASTERED;
    });
    if (nonMastered.length === 0 && dueCardIds.length === 0) {
      return plainToInstance(
        LearnBatchResponseDto,
        { sessionId, cards: [], hasMoreCards: false },
        { excludeExtraneousValues: true },
      );
    }

    // Assemble the ordered candidate list:
    //  1. Due cards (in dueDate order) — even MASTERED cards, since a
    //     review-due mastered card is exactly what SRS wants surfaced.
    //  2. LEARNING (already started) — shuffled when the shuffle
    //     preference is on, otherwise in orderIndex order.
    //  3. NEW (unseen) — same shuffle rule.
    // Deduplicate along the way — a due card that's also LEARNING must
    // appear once, at the front.
    const cardById = new Map(cards.map((c) => [c.id, c]));
    const seenIds = new Set<string>();
    const ordered: typeof cards = [];

    for (const cardId of dueCardIds) {
      const card = cardById.get(cardId);
      if (!card || seenIds.has(card.id)) continue;
      seenIds.add(card.id);
      ordered.push(card);
    }
    const learning = nonMastered.filter(
      (c) =>
        !seenIds.has(c.id) &&
        progressByCardId.get(c.id)?.status === CardMasteryStatus.LEARNING,
    );
    const fresh = nonMastered.filter(
      (c) =>
        !seenIds.has(c.id) &&
        progressByCardId.get(c.id)?.status !== CardMasteryStatus.LEARNING,
    );
    const applyOrder = <T>(xs: T[]) =>
      preferences.shuffleEnabled ? shuffle(xs) : xs;
    ordered.push(...applyOrder(learning), ...applyOrder(fresh));

    const selected = ordered.slice(0, effectiveSize);

    // Prompt selection now reads recent CardAttempt rows per card so
    // it can honour the compassion/challenge paths in
    // select-prompt-type.ts. One roundtrip covers every card in the
    // batch, then we group in memory.
    const recentByCardId = await this.loadRecentAttempts(
      userId,
      selected.map((c) => c.id),
    );

    // Distractor pool is direction-aware: forward mode picks
    // definitions, reverse mode picks terms. Same length-bucket logic
    // regardless.
    const distractorPool = cards.map((c) => ({
      id: c.id,
      answerText: answerOf(c),
    }));

    const batchCards: LearnBatchCardDto[] = selected.map((card) => {
      const progress = progressByCardId.get(card.id);
      const streak = progress ? Number(progress.weightedStreak) : 0;
      const answerText = answerOf(card);
      const promptText = promptOf(card);

      const distractors = pickDistractors(
        { id: card.id, answerText },
        distractorPool,
        3,
      );
      const canRenderMC = distractors.length >= 3;

      const promptType = selectPromptType({
        streak,
        writtenThreshold,
        distractorPoolSize: distractors.length,
        recentAttempts: recentByCardId.get(card.id) ?? [],
        now,
      });

      if (promptType === 'LEARN_WRITTEN' || !canRenderMC) {
        return {
          cardId: card.id,
          term: promptText,
          hint: card.hint,
          answerDirection: preferences.answerDirection,
          promptType: 'LEARN_WRITTEN' as LearnPromptType,
        };
      }

      const choices = shuffle([answerText, ...distractors]);
      return {
        cardId: card.id,
        term: promptText,
        hint: card.hint,
        answerDirection: preferences.answerDirection,
        promptType,
        choices,
        correctChoiceIndex: choices.indexOf(answerText),
      };
    });

    return plainToInstance(
      LearnBatchResponseDto,
      {
        sessionId,
        cards: batchCards,
        hasMoreCards: ordered.length > selected.length,
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Pull the most recent CardAttempt rows for a set of cards, grouped
   * by cardId with the newest attempt first. Used by the prompt
   * selector — it only looks at the last few attempts per card, so
   * `take` is intentionally small.
   */
  private async loadRecentAttempts(
    userId: string,
    cardIds: string[],
  ): Promise<Map<string, RecentAttempt[]>> {
    if (cardIds.length === 0) return new Map();
    // Grab a generous window then group in memory — a per-card
    // subquery would be one round-trip per card. `take` caps the read
    // so the query stays bounded even on a set the learner has drilled
    // for hours.
    const rows = await this.prisma.cardAttempt.findMany({
      where: { userId, cardId: { in: cardIds } },
      orderBy: { createdAt: 'desc' },
      take: cardIds.length * 6,
      select: {
        cardId: true,
        studyMode: true,
        outcome: true,
        hintUsed: true,
        createdAt: true,
      },
    });

    const grouped = new Map<string, RecentAttempt[]>();
    for (const row of rows) {
      const bucket = grouped.get(row.cardId) ?? [];
      // Cap per-card to the top few — selectPromptType only reads a
      // 3-attempt window.
      if (bucket.length < 5) {
        bucket.push({
          studyMode: row.studyMode,
          outcome: row.outcome,
          hintUsed: row.hintUsed,
          createdAt: row.createdAt,
        });
      }
      grouped.set(row.cardId, bucket);
    }
    return grouped;
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

  /**
   * Return the caller's most recent ACTIVE or PAUSED session for the
   * given (set, mode) — used by the Learn entry page to decide whether
   * to show the Resume dialog before starting a new session. Sweeps
   * long-idle rows to ABANDONED first so the response reflects reality.
   */
  async getInflightSession(
    userId: string,
    setId: string,
    mode: StudySessionMode,
  ): Promise<InflightSessionResponseDto | null> {
    const canAccess = await this.studySetService.canAccess(userId, setId);
    if (!canAccess) throw new ForbiddenException('Study set is private');

    await this.sweepAbandonedSessions(userId);

    const session = await this.prisma.studySession.findFirst({
      where: {
        userId,
        studySetId: setId,
        mode,
        status: { in: [StudySessionStatus.ACTIVE, StudySessionStatus.PAUSED] },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
    if (!session) return null;

    return plainToInstance(
      InflightSessionResponseDto,
      {
        sessionId: session.id,
        studySetId: session.studySetId,
        mode: session.mode,
        status: session.status,
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt,
        cardsStudied: session.cardsStudied,
        resumeState: session.resumeState ?? null,
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * "I answered correctly" override — the learner asserts the previous
   * answer was actually right (e.g. the written evaluator false-flagged
   * a synonym). We reclassify the most recent CardAttempt for
   * (session, card) from INCORRECT to CORRECT and apply compensating
   * deltas:
   *
   *  - CardAttempt: outcome → CORRECT (similarity/editDistance kept
   *    for audit, so the original judgment stays inspectable).
   *  - UserCardProgress: swap one incorrect for one correct, add
   *    credit to weightedStreak (INCORRECT had reset it to 0),
   *    graduate if the new streak crosses threshold.
   *  - StudySession counters mirror the swap.
   *  - SRS: forward a GOOD rating so the schedule reflects a correct
   *    answer instead of AGAIN.
   *
   * Does not attempt to restore the pre-INCORRECT streak (we don't
   * persist it), so a mid-run override doesn't return the learner to
   * exactly the same trajectory — the mastery hit is minimised, not
   * fully undone. Idempotent: overriding an already-CORRECT attempt
   * is a noop.
   */
  async markAnswerCorrect(
    userId: string,
    sessionId: string,
    dto: MarkCorrectDto,
  ): Promise<AnswerResponseDto> {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId)
      throw new ForbiddenException('Not your session');
    if (
      session.status === StudySessionStatus.COMPLETED ||
      session.completedAt
    ) {
      throw new ConflictException('Session already completed');
    }
    if (session.status === StudySessionStatus.ABANDONED) {
      throw new ConflictException('Session was abandoned');
    }

    const card = await this.prisma.flashcard.findUnique({
      where: { id: dto.cardId },
      select: { id: true, studySetId: true, term: true, definition: true },
    });
    if (!card) throw new NotFoundException('Flashcard not found');
    if (card.studySetId !== session.studySetId) {
      throw new ConflictException("Card does not belong to this session's set");
    }

    const preferences = await this.setPreferencesService.getForCaller(
      userId,
      card.studySetId,
    );

    const lastAttempt = await this.prisma.cardAttempt.findFirst({
      where: { userId, sessionId, cardId: card.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!lastAttempt) {
      throw new ConflictException(
        'No attempt to override for this card in this session',
      );
    }
    if (lastAttempt.outcome === AttemptOutcomeStatus.CORRECT) {
      // Idempotent: return current state without another mutation.
      return this.buildOverrideResponse(
        userId,
        card.studySetId,
        card,
        session,
        preferences.answerDirection,
      );
    }
    if (lastAttempt.outcome === AttemptOutcomeStatus.SKIPPED) {
      throw new ConflictException(
        'Skipped attempts cannot be overridden — answer the card again',
      );
    }

    const modeWeight = MODE_WEIGHT[lastAttempt.studyMode as StudyMode] ?? 0;
    const credit = lastAttempt.hintUsed
      ? modeWeight * preferences.hintMultiplier
      : modeWeight;

    const now = new Date();
    const today = await this.srsService.getUserDayStart(userId, now);

    const raw = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userCardProgress.findUnique({
        where: { userId_cardId: { userId, cardId: card.id } },
      });
      const prevStatus: CardMasteryStatus =
        existing?.status ?? CardMasteryStatus.NEW;

      const newStreakNumeric = Number(existing?.weightedStreak ?? 0) + credit;
      const reachedMastery = newStreakNumeric >= preferences.masteryThreshold;
      const graduated =
        reachedMastery && prevStatus !== CardMasteryStatus.MASTERED;
      const nextStatus: CardMasteryStatus = reachedMastery
        ? CardMasteryStatus.MASTERED
        : prevStatus === CardMasteryStatus.MASTERED
          ? CardMasteryStatus.MASTERED
          : CardMasteryStatus.LEARNING;

      const persistedCard = await tx.userCardProgress.upsert({
        where: { userId_cardId: { userId, cardId: card.id } },
        create: {
          userId,
          cardId: card.id,
          setId: card.studySetId,
          status: nextStatus,
          weightedStreak: new Prisma.Decimal(newStreakNumeric.toFixed(2)),
          correctCount: 1,
          incorrectCount: 0,
          hintsUsedCount: lastAttempt.hintUsed ? 1 : 0,
          timesDemoted: 0,
          masteredAt: graduated ? now : null,
          lastStudyMode: granularToCoarse(lastAttempt.studyMode as StudyMode),
          lastAttemptedAt: now,
        },
        update: {
          status: nextStatus,
          weightedStreak: new Prisma.Decimal(newStreakNumeric.toFixed(2)),
          correctCount: { increment: 1 },
          // Guard against underflow — if the counters have already
          // been touched by an override earlier in the session and
          // reached zero, don't push them negative.
          incorrectCount:
            (existing?.incorrectCount ?? 0) > 0 ? { decrement: 1 } : undefined,
          masteredAt: graduated ? now : existing?.masteredAt,
          lastStudyMode: granularToCoarse(lastAttempt.studyMode as StudyMode),
          lastAttemptedAt: now,
        },
      });

      // Rewrite the audit row. The wrong-shaped inputs (similarity,
      // editDistance) stay so a data-analyst can still see the
      // original judgment; only the outcome flips.
      await tx.cardAttempt.update({
        where: { id: lastAttempt.id },
        data: { outcome: AttemptOutcomeStatus.CORRECT },
      });

      // Session counters mirror the swap.
      await tx.studySession.update({
        where: { id: session.id },
        data: {
          correctAnswers: { increment: 1 },
          incorrectAnswers:
            session.incorrectAnswers > 0 ? { decrement: 1 } : undefined,
        },
      });

      // Set progress delta if the mastery status transitioned.
      const setProgress = await this.applySetProgressDelta(
        tx,
        userId,
        card.studySetId,
        prevStatus,
        nextStatus,
        existing !== null,
      );

      // SRS: forward-compensate with GOOD. Since the earlier AGAIN
      // already ran, the schedule can't be fully undone; a GOOD
      // rating here moves it back toward "on track" without special
      // rewind logic.
      await this.srsService.applyReviewByCard(
        tx,
        userId,
        card.id,
        'GOOD',
        today,
        now,
      );

      return {
        correct: true,
        correctAnswer:
          preferences.answerDirection ===
          LearnAnswerDirection.DEFINITION_TO_TERM
            ? card.term
            : card.definition,
        graduated,
        demoted: false,
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
    this.logger.log(
      `Answer override applied: userId=${userId} sessionId=${sessionId} cardId=${card.id}`,
    );

    return plainToInstance(
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
  }

  /** Idempotent-response helper for markAnswerCorrect when the target
   *  attempt is already CORRECT — reads the current progress rows and
   *  returns them unchanged. */
  private async buildOverrideResponse(
    userId: string,
    setId: string,
    card: { id: string; term: string; definition: string },
    _session: StudySession,
    direction: LearnAnswerDirection,
  ): Promise<AnswerResponseDto> {
    const [progress, setProgress] = await Promise.all([
      this.prisma.userCardProgress.findUnique({
        where: { userId_cardId: { userId, cardId: card.id } },
      }),
      this.prisma.userSetProgress.findUnique({
        where: { userId_setId: { userId, setId } },
      }),
    ]);
    const totalCards =
      setProgress?.totalCards ??
      (await this.prisma.flashcard.count({ where: { studySetId: setId } }));

    return plainToInstance(
      AnswerResponseDto,
      {
        correct: true,
        correctAnswer:
          direction === LearnAnswerDirection.DEFINITION_TO_TERM
            ? card.term
            : card.definition,
        graduated: false,
        demoted: false,
        cardProgress: plainToInstance(
          CardProgressSummaryDto,
          {
            status: progress?.status ?? CardMasteryStatus.NEW,
            weightedStreak: (progress?.weightedStreak ?? 0).toString(),
            correctCount: progress?.correctCount ?? 0,
            incorrectCount: progress?.incorrectCount ?? 0,
            masteredAt: progress?.masteredAt ?? null,
          },
          { excludeExtraneousValues: true },
        ),
        setProgress: plainToInstance(
          SetProgressSummaryDto,
          {
            totalCards,
            newCount: setProgress?.newCount ?? totalCards,
            learningCount: setProgress?.learningCount ?? 0,
            masteredCount: setProgress?.masteredCount ?? 0,
          },
          { excludeExtraneousValues: true },
        ),
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Snapshot the client's in-flight state and flip the session to
   * PAUSED. Called from an explicit "Pause" button and (best-effort)
   * from the tab-close beacon. Safe to call on an ACTIVE or PAUSED
   * session; noop on COMPLETED/ABANDONED sessions.
   */
  async pauseSession(
    userId: string,
    sessionId: string,
    dto: PauseSessionDto,
  ): Promise<void> {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId)
      throw new ForbiddenException('Not your session');
    if (
      session.status === StudySessionStatus.COMPLETED ||
      session.status === StudySessionStatus.ABANDONED
    ) {
      return;
    }

    await this.prisma.studySession.update({
      where: { id: sessionId },
      data: {
        status: StudySessionStatus.PAUSED,
        resumeState:
          dto.resumeState !== undefined
            ? (dto.resumeState as Prisma.InputJsonValue)
            : undefined,
      },
    });
    this.logger.log(`Session paused: id=${sessionId}`);
  }

  /**
   * Explicit abandon — used when the learner picks "Start fresh" on
   * the Resume dialog. The old session's mastery is preserved; only
   * the shell is marked so the concurrent-session guard on POST
   * /sessions lets the next start through.
   */
  async abandonSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId)
      throw new ForbiddenException('Not your session');
    if (
      session.status === StudySessionStatus.COMPLETED ||
      session.status === StudySessionStatus.ABANDONED
    ) {
      return;
    }

    await this.prisma.studySession.update({
      where: { id: sessionId },
      data: {
        status: StudySessionStatus.ABANDONED,
        resumeState: Prisma.DbNull,
      },
    });
    // Symmetric with completeSession — flush any stale cached counts
    // so the module page sees the current state next fetch.
    await this.invalidateSetProgressCache(userId, session.studySetId);
    this.logger.log(`Session abandoned: id=${sessionId}`);
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
