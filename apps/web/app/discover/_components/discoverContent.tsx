'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, Search, SearchX, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CommunityModule as CommunitySearchHit } from '@/lib/api';
import { useCommunityModules } from '@/lib/hooks/useModules';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { toast } from 'sonner';
import { DiscoverLoading } from './discoverSkeleton';

const PageSize = 20;

// A small fixed list of common languages. The API accepts any string,
// so we could later replace this with a tags-style endpoint that
// returns the languages actually present in the corpus.
const LanguageOptions: { value: string; label: string }[] = [
  { value: 'English', label: 'English' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'French', label: 'French' },
  { value: 'German', label: 'German' },
  { value: 'Italian', label: 'Italian' },
  { value: 'Portuguese', label: 'Portuguese' },
  { value: 'Russian', label: 'Russian' },
  { value: 'Turkish', label: 'Turkish' },
  { value: 'Azerbaijani', label: 'Azerbaijani' },
  { value: 'Arabic', label: 'Arabic' },
  { value: 'Chinese', label: 'Chinese' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Korean', label: 'Korean' },
];

// Radix Select doesn't allow "" as an item value, so we use a
// sentinel and translate at query-build time.
const allLanguages = '__all__';

export default function DiscoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL is the source of truth for shareable filter state (q, tag,
  // language). The input has its own local state so typing feels
  // instant; a debounce syncs it back into the URL.
  const urlQ = searchParams.get('q') ?? '';
  const urlTag = searchParams.get('tag') ?? '';
  const urlLanguage = searchParams.get('language') ?? '';

  const [searchInput, setSearchInput] = useState(urlQ);
  const [language, setLanguage] = useState<string>(urlLanguage || allLanguages);
  const [tag, setTag] = useState<string>(urlTag);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(searchInput);

  // Keep input state in sync when the URL changes externally
  // (e.g. navbar submit, back button, a clicked tag chip).
  // We need to track previous URL values to detect changes
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  const [prevUrlTag, setPrevUrlTag] = useState(urlTag);
  const [prevUrlLanguage, setPrevUrlLanguage] = useState(urlLanguage);

  if (urlQ !== prevUrlQ || urlTag !== prevUrlTag || urlLanguage !== prevUrlLanguage) {
    setSearchInput(urlQ);
    setTag(urlTag);
    setLanguage(urlLanguage || allLanguages);
    setPage(1);
    setPrevUrlQ(urlQ);
    setPrevUrlTag(urlTag);
    setPrevUrlLanguage(urlLanguage);
  }

  // Mirror the debounced draft state back into the URL so the current
  // filters can be shared or bookmarked. `router.replace` avoids
  // stacking a history entry on every keystroke.
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
    if (tag) params.set('tag', tag);
    if (language !== allLanguages) params.set('language', language);
    const qs = params.toString();
    const target = qs ? `/discover?${qs}` : '/discover';
    const current = searchParams.toString();
    const currentFull = current ? `/discover?${current}` : '/discover';
    if (target !== currentFull) {
      router.replace(target, { scroll: false });
    }
  }, [debouncedSearch, tag, language, router, searchParams]);

  const query = {
    q: debouncedSearch,
    language: language === allLanguages ? undefined : language,
    tag: tag || undefined,
    page,
    limit: PageSize,
  };

  const { data, isLoading, isError, isFetching } = useCommunityModules(query);

  if (isLoading) {
    return <DiscoverLoading />;
  }

  if (isError) {
    toast.error('Failed to load community modules');
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PageSize));

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  const handleTagClick = (t: string) => {
    setTag((current) => (current === t ? '' : t));
    setPage(1);
  };

  const clearTag = () => {
    setTag('');
    setPage(1);
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 md:py-8">
      {/* Header Section */}
      <div className="mb-8 md:mb-12 space-y-3">
        <h2 className="text-2xl md:text-3xl lg:text-4xl text-neutral-700 font-bold text-center">
          Community Modules
        </h2>
        <p className="text-center text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          Search and explore modules shared by the Mimir community. Full-text search across titles,
          descriptions, and tags.
        </p>
      </div>

      {/* Search Section — debounced, no submit button. The old submit-
          to-search pattern was cargo-culted from a client-filter world
          where each keystroke was cheap. With an ES call per query, a
          250 ms debounce is a better fit. */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Input
              type="text"
              startIcon={<Search />}
              placeholder="Search titles, descriptions, and tags…"
              className="pr-10"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {isFetching && (
              <Loader2
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
              />
            )}
          </div>
          <Select
            value={language}
            onValueChange={(v) => {
              setLanguage(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allLanguages}>All languages</SelectItem>
              {LanguageOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tag && (
          <div className="mt-3 flex items-center justify-center gap-2 text-sm">
            <span className="text-gray-500">Filtering by tag:</span>
            <button
              type="button"
              onClick={clearTag}
              className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-brand-700 hover:bg-brand-100"
              aria-label={`Remove tag filter ${tag}`}
            >
              #{tag}
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {total > 0 && (
          <p className="text-xs text-center text-gray-500 mt-2">
            {total.toLocaleString()} {total === 1 ? 'result' : 'results'}
            {debouncedSearch && ` for “${debouncedSearch}”`}
            {tag && ` tagged #${tag}`}
            {language !== allLanguages && ` in ${language}`}
          </p>
        )}
      </div>

      {/* Results Grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {items.map((m: CommunitySearchHit) => (
            <CommunityCard
              key={m.id}
              hit={m}
              activeTag={tag}
              onOpen={() => router.push(`/modules/${m.id}`)}
              onTagClick={handleTagClick}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 && !isFetching && (
        <div className="text-center py-12 md:py-16 max-w-lg mx-auto">
          <SearchX className="mx-auto text-gray-400 mb-3" size={36} />
          <p className="text-gray-800 font-semibold mb-1">
            {debouncedSearch || tag ? `No modules match your filters` : 'No community modules yet'}
          </p>
          <p className="text-sm text-gray-500">
            {debouncedSearch || tag
              ? 'Try a different search or clear the tag filter.'
              : 'Be the first to share one. Public modules appear here once created.'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft size={16} className="mr-1" /> Prev
          </Button>
          <span className="text-sm text-gray-500 min-w-24 text-center">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      )}
    </main>
  );
}

function CommunityCard({
  hit,
  activeTag,
  onOpen,
  onTagClick,
}: {
  hit: CommunitySearchHit;
  activeTag: string;
  onOpen: () => void;
  onTagClick: (tag: string) => void;
}) {
  const ownerInitials = (hit.ownerUsername ?? '?').slice(0, 2).toUpperCase();
  // Titles/descriptions may be returned with <em>…</em> highlight markup
  // in the future (highlights field). For now render plain text — the
  // highlighter would be a follow-up if we want it.
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold line-clamp-2 mb-2">{hit.title}</h3>
            {hit.description && (
              <p className="text-muted-foreground text-sm line-clamp-2">{hit.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">
              {hit.cardCount} {hit.cardCount === 1 ? 'card' : 'cards'}
            </span>
            {hit.language && (
              <span className="bg-brand-500/10 text-brand-500 rounded-full px-3 py-1 text-xs font-medium">
                {hit.language}
              </span>
            )}
            {hit.tags.slice(0, 3).map((tagName) => {
              const isActive = activeTag === tagName;
              return (
                <button
                  key={tagName}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick(tagName);
                  }}
                  className={
                    'rounded-full px-2 py-0.5 text-xs transition-colors ' +
                    (isActive
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                  }
                  aria-pressed={isActive}
                >
                  #{tagName}
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-0 space-y-4">
        <div>
          <p className="text-xs text-gray-500 mb-2">Shared by:</p>
          <div className="flex gap-2 items-center">
            <Avatar className="size-8 border border-gray-100 shrink-0">
              <AvatarFallback className="text-xs">{ownerInitials}</AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium truncate">{hit.ownerUsername ?? 'Unknown'}</p>
          </div>
        </div>

        <Button size="sm" className="w-full" onClick={onOpen}>
          View Module
        </Button>
      </CardContent>
    </Card>
  );
}
