import { useQuery } from '@tanstack/react-query';
import { apiFetch, type Schemas } from '@/lib/api/client';

export type FlashcardSearchHit = Schemas['FlashcardSearchHitDto'];
export type FlashcardSearchResult = Schemas['FlashcardSearchResponseDto'];

interface Params {
  q: string;
  setId?: string;
  limit?: number;
}

/**
 * Search cards across every set the caller can access. Skipped when
 * the query is shorter than 2 characters — the backend enforces this
 * with a 400, but suppressing the request altogether saves a round
 * trip on every keystroke.
 */
export function useFlashcardSearch(params: Params) {
  const q = params.q.trim();
  const enabled = q.length >= 2;
  return useQuery({
    queryKey: ['flashcard-search', q, params.setId ?? null, params.limit ?? 10],
    queryFn: async () => {
      const res = await apiFetch('get', '/flashcards/search', {
        query: {
          q,
          ...(params.setId ? { setId: params.setId } : {}),
          limit: params.limit ?? 10,
        },
      });
      if (!res?.ok || !res.data) {
        throw new Error(res?.message || 'Flashcard search failed');
      }
      return res.data as FlashcardSearchResult;
    },
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}
