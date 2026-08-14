/**
 * Frontend API surface.
 *
 * All request/response shapes are inferred from the server's OpenAPI spec
 * via `apps/web/lib/api/generated.ts`. See `apps/web/lib/api/client.ts` for
 * the typed axios wrapper — it turns URL/param/body/response mismatches
 * into compile errors instead of runtime 500s.
 *
 * Regenerate types with `pnpm --filter @mimir/web generate:api-types`.
 */

import type { AxiosError } from 'axios';
import { apiFetch, type Schemas } from './api/client';

// ============================================
// TYPE RE-EXPORTS (generated from the server)
// ============================================

export type Module = Schemas['StudySetResponseDto'];
/**
 * Search hit from `/search/sets` (Elasticsearch-backed community search).
 * Shape differs from `Module`: no isPrivate/isOwner/isCollected/flashcardsCount,
 * gained cardCount/likeCount/score/highlights/tags/ownerUsername.
 */
export type CommunityModule = Schemas['SearchSetHitDto'];
export type CreateModuleData = Schemas['CreateStudySetDto'];
export type UpdateModuleData = Schemas['UpdateStudySetDto'];

// Flashcards are called "terms" on the frontend. Adapt the shape so the
// existing components (which expect `moduleId`, `isStarred`, `status`)
// keep working. Real per-user progress is fetched separately via
// `GET /flashcards/{id}/progress`.
export interface Term {
  id: string;
  term: string;
  definition: string;
  moduleId: string;
  isStarred: boolean;
  status: 'not_started' | 'in_progress' | 'completed';
}

export interface CreateTermData {
  term: string;
  definition: string;
  moduleId: string;
  isStarred: boolean;
}

export interface UpdateTermData {
  term?: string;
  definition?: string;
  isStarred?: boolean;
}

// ============================================
// HELPERS
// ============================================

type Envelope<T> = { ok: boolean; message?: string; data?: T };

function unwrap<T>(res: Envelope<T> | undefined, fallback: string): T {
  if (!res?.ok || res.data === undefined) {
    throw new Error(res?.message || fallback);
  }
  return res.data;
}

function extractError(error: unknown, fallback: string): Error {
  const axiosError = error as AxiosError<{ message?: string }>;
  return new Error(axiosError.response?.data?.message || fallback);
}

function flashcardToTerm(fc: Schemas['FlashcardResponseDto']): Term {
  return {
    id: fc.id,
    term: fc.term,
    definition: fc.definition,
    moduleId: fc.studySetId,
    isStarred: false,
    status: 'not_started',
  };
}

// Server CardMasteryStatus (NEW/LEARNING/MASTERED) → the UI-facing triad
// the existing components already render against.
const MASTERY_TO_STATUS: Record<
  Schemas['FlashcardWithProgressDto']['status'],
  Term['status']
> = {
  NEW: 'not_started',
  LEARNING: 'in_progress',
  MASTERED: 'completed',
};

function flashcardWithProgressToTerm(
  fc: Schemas['FlashcardWithProgressDto'],
  moduleId: string,
): Term {
  return {
    id: fc.id,
    term: fc.term,
    definition: fc.definition,
    moduleId,
    isStarred: fc.isStarred,
    status: MASTERY_TO_STATUS[fc.status] ?? 'not_started',
  };
}

// ============================================
// MODULES
// ============================================

export async function getModules(q?: string): Promise<Module[]> {
  try {
    // Server-side title/description substring filter.  Trimmed empty
    // strings are omitted so React Query cache-keys aren't polluted
    // with the same "unfiltered" list under multiple keys.
    const trimmed = q?.trim();
    const res = await apiFetch('get', '/study-sets/collection', {
      query: trimmed ? { q: trimmed } : undefined,
    });
    return unwrap(res, 'Failed to fetch modules');
  } catch (error) {
    throw extractError(error, 'Failed to fetch modules');
  }
}

export async function getRecentModules(limit = 4): Promise<Module[]> {
  const all = await getModules();
  return all.slice(0, limit);
}

export type RecentStudySet = Schemas['RecentStudySetDto'];

/**
 * Sets I've actually studied, most recent first. Distinct from
 * `getRecentModules` — that one is a client-side slice of the entire
 * collection (owned+favourited) sorted by updatedAt. This one is
 * server-driven, sorted by UserSetProgress.lastStudiedAt, and carries
 * per-user mastery counts.
 */
export async function getRecentStudiedSets(limit = 5): Promise<RecentStudySet[]> {
  try {
    const res = await apiFetch('get', '/study-sets/recent', {
      query: { limit: String(limit) },
    });
    return unwrap(res, 'Failed to load recent sets');
  } catch (error) {
    throw extractError(error, 'Failed to load recent sets');
  }
}

/** Popular public sets for the dashboard Discover strip. */
export async function getPopularPublicSets(limit = 6): Promise<Module[]> {
  try {
    const res = await apiFetch('get', '/study-sets/public', {
      query: { sort: 'popular' },
    });
    const all = unwrap(res, 'Failed to load popular sets');
    return all.slice(0, limit);
  } catch (error) {
    throw extractError(error, 'Failed to load popular sets');
  }
}

// ============================================
// COMMUNITY (Elasticsearch-backed /search/sets)
// ============================================

export type CommunitySearchHit = Schemas['SearchSetHitDto'];
export type CommunitySearchResult = Schemas['SearchSetsResponseDto'];

export interface CommunitySearchParams {
  q?: string;
  language?: string;
  tag?: string;
  page?: number;
  limit?: number;
}

export async function searchCommunity(
  params: CommunitySearchParams = {},
): Promise<CommunitySearchResult> {
  try {
    const query: {
      q?: string;
      language?: string;
      tag?: string;
      page?: number;
      limit?: number;
    } = {};
    const trimmed = params.q?.trim();
    if (trimmed) query.q = trimmed;
    if (params.language) query.language = params.language;
    if (params.tag) query.tag = params.tag;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;

    const res = await apiFetch('get', '/search/sets', { query });
    return unwrap(res, 'Failed to search community modules');
  } catch (error) {
    throw extractError(error, 'Failed to search community modules');
  }
}

// NOTE: kept loosely typed to preserve compat with `/modules/[id]` pages
// that read `moduleData.data.<field>`. Callers using the envelope shape
// still work; a follow-up should switch to unwrapped access.
export async function getModuleById(id: string) {
  try {
    return await apiFetch('get', '/study-sets/{id}', { path: { id } });
  } catch (error) {
    throw extractError(error, 'Failed to fetch module');
  }
}

export async function createModule(data: CreateModuleData): Promise<Module> {
  try {
    const res = await apiFetch('post', '/study-sets', { body: data });
    return unwrap(res, 'Failed to create module');
  } catch (error) {
    throw extractError(error, 'Failed to create module');
  }
}

export async function updateModule(id: string, data: UpdateModuleData): Promise<Module> {
  try {
    const res = await apiFetch('patch', '/study-sets/{id}', {
      path: { id },
      body: data,
    });
    return unwrap(res, 'Failed to update module');
  } catch (error) {
    throw extractError(error, 'Failed to update module');
  }
}

export async function deleteModule(id: string): Promise<void> {
  try {
    await apiFetch('delete', '/study-sets/{id}', { path: { id } });
  } catch (error) {
    throw extractError(error, 'Failed to delete module');
  }
}

export async function collectModule(id: string): Promise<Module> {
  try {
    const res = await apiFetch('post', '/me/library/{studySetId}', {
      path: { studySetId: id },
    });
    return unwrap(res, 'Failed to collect module');
  } catch (error) {
    throw extractError(error, 'Failed to collect module');
  }
}

export async function uncollectModule(id: string): Promise<void> {
  try {
    await apiFetch('delete', '/me/library/{studySetId}', {
      path: { studySetId: id },
    });
  } catch (error) {
    throw extractError(error, 'Failed to uncollect module');
  }
}

// ============================================
// LIBRARY + FOLDERS (Sprint 2)
// ============================================

export type LibraryItem = Schemas['LibraryItemDto'];
export type Folder = Schemas['FolderResponseDto'];
export type FolderStudySetItem = Schemas['FolderStudySetItemDto'];
export type CreateFolderData = Schemas['CreateFolderDto'];
export type UpdateFolderData = Schemas['UpdateFolderDto'];

export async function getLibrary(): Promise<LibraryItem[]> {
  try {
    const res = await apiFetch('get', '/me/library');
    return unwrap(res, 'Failed to load library');
  } catch (error) {
    throw extractError(error, 'Failed to load library');
  }
}

export async function getFolders(): Promise<Folder[]> {
  try {
    const res = await apiFetch('get', '/folders');
    return unwrap(res, 'Failed to load folders');
  } catch (error) {
    throw extractError(error, 'Failed to load folders');
  }
}

export async function getFolderById(id: string): Promise<Folder> {
  try {
    const res = await apiFetch('get', '/folders/{id}', { path: { id } });
    return unwrap(res, 'Failed to load folder');
  } catch (error) {
    throw extractError(error, 'Failed to load folder');
  }
}

export async function createFolder(data: CreateFolderData): Promise<Folder> {
  try {
    const res = await apiFetch('post', '/folders', { body: data });
    return unwrap(res, 'Failed to create folder');
  } catch (error) {
    throw extractError(error, 'Failed to create folder');
  }
}

export async function updateFolder(
  id: string,
  data: UpdateFolderData,
): Promise<Folder> {
  try {
    const res = await apiFetch('patch', '/folders/{id}', {
      path: { id },
      body: data,
    });
    return unwrap(res, 'Failed to update folder');
  } catch (error) {
    throw extractError(error, 'Failed to update folder');
  }
}

export async function deleteFolder(id: string): Promise<void> {
  try {
    await apiFetch('delete', '/folders/{id}', { path: { id } });
  } catch (error) {
    throw extractError(error, 'Failed to delete folder');
  }
}

export async function addSetsToFolder(
  folderId: string,
  studySetIds: string[],
): Promise<void> {
  try {
    await apiFetch('post', '/folders/{id}/study-sets', {
      path: { id: folderId },
      body: { studySetIds },
    });
  } catch (error) {
    throw extractError(error, 'Failed to add sets to folder');
  }
}

export async function removeSetFromFolder(
  folderId: string,
  studySetId: string,
): Promise<void> {
  try {
    await apiFetch('delete', '/folders/{id}/study-sets/{studySetId}', {
      path: { id: folderId, studySetId },
    });
  } catch (error) {
    throw extractError(error, 'Failed to remove set from folder');
  }
}

// ============================================
// TERMS (flashcards)
// ============================================

export type MasteryStatus = Schemas['FlashcardWithProgressDto']['status'];

export interface TermsFilter {
  starred?: boolean;
  status?: MasteryStatus;
  /** Case-insensitive substring on term/definition. */
  q?: string;
}

export async function getTermsWithProgress(
  moduleId: string,
  filter: TermsFilter = {},
): Promise<Term[]> {
  try {
    const query: { starred?: boolean; status?: MasteryStatus; q?: string } = {};
    if (filter.starred !== undefined) query.starred = filter.starred;
    if (filter.status !== undefined) query.status = filter.status;
    const trimmed = filter.q?.trim();
    if (trimmed) query.q = trimmed;

    const res = await apiFetch('get', '/study-sets/{setId}/cards/progress', {
      path: { setId: moduleId },
      query,
    });
    return unwrap(res, 'Failed to fetch terms').map((fc) =>
      flashcardWithProgressToTerm(fc, moduleId),
    );
  } catch (error) {
    throw extractError(error, 'Failed to fetch terms');
  }
}

export async function getTermsByModuleId(moduleId: string): Promise<Term[]> {
  try {
    const res = await apiFetch('get', '/study-sets/{setId}/cards', {
      path: { setId: moduleId },
    });
    return unwrap(res, 'Failed to fetch terms').map(flashcardToTerm);
  } catch (error) {
    throw extractError(error, 'Failed to fetch terms');
  }
}

export async function createTerm(termData: CreateTermData): Promise<Term> {
  try {
    const res = await apiFetch('post', '/study-sets/{setId}/cards', {
      path: { setId: termData.moduleId },
      body: { term: termData.term, definition: termData.definition },
    });
    return flashcardToTerm(unwrap(res, 'Failed to create term'));
  } catch (error) {
    throw extractError(error, 'Failed to create term');
  }
}

export async function updateTerm(id: string, termData: UpdateTermData): Promise<Term> {
  try {
    const patch: Schemas['UpdateFlashcardDto'] = {};
    if (termData.term !== undefined) patch.term = termData.term;
    if (termData.definition !== undefined) patch.definition = termData.definition;
    // isStarred lives on progress, not on the flashcard row — handled
    // separately via toggleTermStar() below.
    const res = await apiFetch('patch', '/flashcards/{id}', {
      path: { id },
      body: patch,
    });
    return flashcardToTerm(unwrap(res, 'Failed to update term'));
  } catch (error) {
    throw extractError(error, 'Failed to update term');
  }
}

export async function deleteTerm(id: string): Promise<void> {
  try {
    await apiFetch('delete', '/flashcards/{id}', { path: { id } });
  } catch (error) {
    throw extractError(error, 'Failed to delete term');
  }
}

export async function toggleTermStar(id: string, isStarred: boolean) {
  try {
    const res = await apiFetch('put', '/flashcards/{id}/star', {
      path: { id },
      body: { isStarred },
    });
    return unwrap(res, 'Failed to update star');
  } catch (error) {
    throw extractError(error, 'Failed to update star');
  }
}

// ============================================
// TERM PROGRESS (kept as-is; endpoints not yet wired on server side)
// ============================================

export async function getTermProgress(id: string) {
  try {
    const res = await apiFetch('get', '/flashcards/{id}/progress', {
      path: { id },
    });
    return unwrap(res, 'Failed to fetch term progress');
  } catch (error) {
    throw extractError(error, 'Failed to fetch term progress');
  }
}

export async function resetSetProgress(setId: string): Promise<void> {
  try {
    await apiFetch('delete', '/study-sets/{setId}/my-progress', {
      path: { setId },
    });
  } catch (error) {
    throw extractError(error, 'Failed to reset progress');
  }
}

// ============================================
// STUDY SESSIONS (TDD §8a.5–§8a.7)
// ============================================

export type StudyMode = Schemas['SubmitAnswerDto']['studyMode'];
export type AttemptOutcome = Schemas['SubmitAnswerDto']['outcome'];
export type SessionMode = Schemas['StartSessionDto']['mode'];

export type StartSessionResponse = Schemas['StartSessionResponseDto'];
export type AnswerResponse = Schemas['AnswerResponseDto'];
export type SessionSummary = Schemas['SessionSummaryDto'];

export async function startSession(
  studySetId: string,
  mode: SessionMode,
): Promise<StartSessionResponse> {
  try {
    const res = await apiFetch('post', '/sessions', {
      body: { studySetId, mode },
    });
    return unwrap(res, 'Failed to start session');
  } catch (error) {
    throw extractError(error, 'Failed to start session');
  }
}

/** Resolved directions a per-card submission can carry — MIXED is a
 *  preference, not a per-card value, so it doesn't appear here. */
export type ResolvedAnswerDirection = 'TERM_TO_DEFINITION' | 'DEFINITION_TO_TERM';

export interface SubmitAnswerPayload {
  attemptId: string;
  cardId: string;
  studyMode: StudyMode;
  outcome: AttemptOutcome;
  hintUsed: boolean;
  /** Milliseconds from card render to submit. Logged on the CardAttempt row. */
  responseMs?: number;
  /** Resolved direction from LearnBatchCard.answerDirection — echoed
   *  so the server knows which side was expected under the MIXED pref. */
  answerDirection?: ResolvedAnswerDirection;
}

export async function submitSessionAnswer(
  sessionId: string,
  payload: SubmitAnswerPayload,
): Promise<AnswerResponse> {
  try {
    const res = await apiFetch('post', '/sessions/{id}/answer', {
      path: { id: sessionId },
      body: payload,
    });
    return unwrap(res, 'Failed to submit answer');
  } catch (error) {
    throw extractError(error, 'Failed to submit answer');
  }
}

/**
 * Learner-facing override for a false-negative wrong answer. Flips
 * the most recent CardAttempt for `(session, cardId)` to CORRECT and
 * updates counters / SRS. Returns the same shape as `submitAnswer`
 * so callers can reuse the progress-refresh path.
 */
export async function markAnswerCorrect(
  sessionId: string,
  cardId: string,
): Promise<AnswerResponse> {
  try {
    const res = await apiFetch('post', '/sessions/{id}/mark-correct', {
      path: { id: sessionId },
      body: { cardId },
    });
    return unwrap(res, 'Failed to mark answer correct');
  } catch (error) {
    throw extractError(error, 'Failed to mark answer correct');
  }
}

export async function completeSession(sessionId: string): Promise<SessionSummary> {
  try {
    const res = await apiFetch('post', '/sessions/{id}/complete', {
      path: { id: sessionId },
    });
    return unwrap(res, 'Failed to complete session');
  } catch (error) {
    throw extractError(error, 'Failed to complete session');
  }
}

// ============================================
// LEARN MODE (TDD Sprint 6)
// ============================================

export type LearnBatchCard = Schemas['LearnBatchCardDto'];
export type LearnBatchResponse = Schemas['LearnBatchResponseDto'];
export type LearnPromptType = LearnBatchCard['promptType'];

export type WrittenAnswerResponse = Schemas['WrittenAnswerResponseDto'];
export type WriteEvaluation = Schemas['WriteEvaluationDto'];
export type WrittenStudyMode = Schemas['SubmitWrittenAnswerDto']['studyMode'];

export async function getNextLearnBatch(
  sessionId: string,
  size = 10,
  opts: { dueFirst?: boolean } = {},
): Promise<LearnBatchResponse> {
  try {
    const res = await apiFetch('get', '/sessions/{id}/next-batch', {
      path: { id: sessionId },
      query: opts.dueFirst ? { size, dueFirst: true } : { size },
    });
    return unwrap(res, 'Failed to fetch next batch');
  } catch (error) {
    throw extractError(error, 'Failed to fetch next batch');
  }
}

export interface SubmitWrittenAnswerPayload {
  attemptId: string;
  cardId: string;
  studyMode: WrittenStudyMode;
  userAnswer: string;
  hintUsed: boolean;
  /** Milliseconds from card render to submit. Logged on the CardAttempt row. */
  responseMs?: number;
  /** Resolved direction from LearnBatchCard.answerDirection — echoed
   *  so the server evaluates against the right side under the MIXED pref. */
  answerDirection?: ResolvedAnswerDirection;
}

export async function submitWrittenAnswer(
  sessionId: string,
  payload: SubmitWrittenAnswerPayload,
): Promise<WrittenAnswerResponse> {
  try {
    const res = await apiFetch('post', '/sessions/{id}/answer-written', {
      path: { id: sessionId },
      body: payload,
    });
    return unwrap(res, 'Failed to submit written answer');
  } catch (error) {
    throw extractError(error, 'Failed to submit written answer');
  }
}

export type SessionHistoryItem = Schemas['SessionHistoryItemDto'];
export type SessionStatus = SessionHistoryItem['status'];
export type InflightSession = Schemas['InflightSessionResponseDto'];

/**
 * Client-owned in-flight resume state. The server round-trips this as
 * an opaque JSON blob via `resumeState`; the shape is a client contract
 * declared here so both `useLearnSession` (writer) and the resume
 * dialog (reader) stay in sync.
 */
export interface LearnResumeState {
  batch: LearnBatchCard[];
  batchIndex: number;
  hasMoreCards: boolean;
  savedAt: string;
}

export async function getInflightLearnSession(
  studySetId: string,
): Promise<InflightSession | null> {
  try {
    const res = await apiFetch('get', '/sessions/inflight', {
      query: { setId: studySetId, mode: 'LEARN' },
    });
    // A null `data` means nothing is in flight — return null instead of
    // throwing so callers can render "start fresh" cleanly.
    if (!res?.ok) throw new Error(res?.message || 'Failed to look up session');
    return (res.data as InflightSession | undefined) ?? null;
  } catch (error) {
    throw extractError(error, 'Failed to look up session');
  }
}

export async function pauseSession(
  sessionId: string,
  resumeState?: LearnResumeState,
): Promise<void> {
  try {
    // resumeState is emitted as `Record<string, never>` in the spec —
    // OpenAPI can't describe the client-owned shape. Cast at the call
    // boundary; the server just round-trips the blob.
    const body = (resumeState ? { resumeState } : {}) as never;
    await apiFetch('post', '/sessions/{id}/pause', {
      path: { id: sessionId },
      body,
    });
  } catch (error) {
    throw extractError(error, 'Failed to pause session');
  }
}

export async function abandonSession(sessionId: string): Promise<void> {
  try {
    await apiFetch('post', '/sessions/{id}/abandon', {
      path: { id: sessionId },
    });
  } catch (error) {
    throw extractError(error, 'Failed to abandon session');
  }
}

// ============================================
// SET PREFERENCES (Sprint 2 / Phase 2)
// ============================================

export type SetPreferences = Schemas['SetPreferencesResponseDto'];
export type UpdateSetPreferencesPayload = Schemas['UpdateSetPreferencesDto'];
export type PacePreset = Schemas['ApplyPresetDto']['preset'];

export async function getSetPreferences(setId: string): Promise<SetPreferences> {
  try {
    const res = await apiFetch('get', '/sets/{setId}/preferences', {
      path: { setId },
    });
    return unwrap(res, 'Failed to fetch preferences');
  } catch (error) {
    throw extractError(error, 'Failed to fetch preferences');
  }
}

export async function updateSetPreferences(
  setId: string,
  patch: UpdateSetPreferencesPayload,
): Promise<SetPreferences> {
  try {
    const res = await apiFetch('put', '/sets/{setId}/preferences', {
      path: { setId },
      body: patch,
    });
    return unwrap(res, 'Failed to update preferences');
  } catch (error) {
    throw extractError(error, 'Failed to update preferences');
  }
}

export async function applyPacePreset(
  setId: string,
  preset: PacePreset,
): Promise<SetPreferences> {
  try {
    const res = await apiFetch(
      'post',
      '/sets/{setId}/preferences/apply-preset',
      {
        path: { setId },
        body: { preset },
      },
    );
    return unwrap(res, 'Failed to apply preset');
  } catch (error) {
    throw extractError(error, 'Failed to apply preset');
  }
}


export interface SessionHistoryPage {
  items: SessionHistoryItem[];
  total: number;
  limit: number;
  page: number;
  totalPages: number;
}

export async function getSessionHistory(params: {
  studySetId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<SessionHistoryPage> {
  try {
    const query: { studySetId?: string; limit?: number; offset?: number } = {};
    if (params.studySetId) query.studySetId = params.studySetId;
    if (params.limit !== undefined) query.limit = params.limit;
    if (params.offset !== undefined) query.offset = params.offset;

    const res = await apiFetch('get', '/sessions', { query });
    const items = unwrap(res, 'Failed to fetch sessions');
    // ResponseDto.meta is currently emitted as Record<string, never>
    // because the nested shape isn't decorated. Cast here rather than
    // spread `any` across the caller. TODO: type meta on ResponseDto.
    const meta = (res as unknown as { meta?: {
      total?: number;
      limit?: number;
      page?: number;
      totalPages?: number;
    } }).meta ?? {};
    return {
      items,
      total: meta.total ?? items.length,
      limit: meta.limit ?? items.length,
      page: meta.page ?? 1,
      totalPages: meta.totalPages ?? 1,
    };
  } catch (error) {
    throw extractError(error, 'Failed to fetch sessions');
  }
}

// ============================================
// SRS (Sprint 1)
// ============================================

export type SrsCard = Schemas['SrsCardDto'];
export type SrsReviewResponse = Schemas['SrsReviewResponseDto'];
export type SrsForecast = Schemas['ForecastResponseDto'];
export type SrsRating = Schemas['ReviewSrsCardDto']['rating'];

export interface SrsQueuePage {
  items: SrsCard[];
  total: number;
}

export async function getSrsQueueToday(
  limit = 50,
  offset = 0,
): Promise<SrsQueuePage> {
  try {
    const res = await apiFetch('get', '/srs/queue/today', {
      query: { limit, offset },
    });
    const items = unwrap(res, 'Failed to fetch SRS queue');
    const meta = (res as unknown as { meta?: { total?: number } }).meta ?? {};
    return { items, total: meta.total ?? items.length };
  } catch (error) {
    throw extractError(error, 'Failed to fetch SRS queue');
  }
}

export async function reviewSrsCard(
  srsCardId: string,
  attemptId: string,
  rating: SrsRating,
): Promise<SrsReviewResponse> {
  try {
    const res = await apiFetch('post', '/srs/cards/{id}/review', {
      path: { id: srsCardId },
      body: { attemptId, rating },
    });
    return unwrap(res, 'Failed to submit SRS review');
  } catch (error) {
    throw extractError(error, 'Failed to submit SRS review');
  }
}

export async function getSrsForecast(days = 30): Promise<SrsForecast> {
  try {
    const res = await apiFetch('get', '/srs/forecast', {
      query: { days },
    });
    return unwrap(res, 'Failed to fetch SRS forecast');
  } catch (error) {
    throw extractError(error, 'Failed to fetch SRS forecast');
  }
}

/**
 * Cards due today (in the caller's local day) that belong to a
 * specific set. Powers the "N due today" affordance on the module
 * page and the "Review due" entry into Learn Mode.
 */
export async function getDueQueueForSet(
  setId: string,
  limit = 50,
): Promise<SrsQueuePage> {
  try {
    const res = await apiFetch('get', '/sets/{setId}/due-queue', {
      path: { setId },
      query: { limit },
    });
    const items = unwrap(res, 'Failed to fetch due queue');
    const meta = (res as unknown as { meta?: { total?: number } }).meta ?? {};
    return { items, total: meta.total ?? items.length };
  } catch (error) {
    throw extractError(error, 'Failed to fetch due queue');
  }
}
