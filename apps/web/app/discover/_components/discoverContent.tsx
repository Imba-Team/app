'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Layers,
  Loader2,
  Search,
  SearchX,
  X,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { CommunityModule as CommunitySearchHit } from '@/lib/api';
import { useCommunityModules } from '@/lib/hooks/useModules';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';

const pageSize = 20;
const visibleTagCount = 3;

// A small fixed list of common languages. The API accepts any string,
// so we could later replace this with a tags-style endpoint that
// returns the languages actually present in the corpus.
const languageOptions: { value: string; label: string }[] = [
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

export function DiscoverContent() {
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
    limit: pageSize,
  };

  const { data, isLoading, isError, isFetching, refetch } = useCommunityModules(query);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(debouncedSearch.trim() || tag || language !== allLanguages);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  const handleTagClick = (t: string) => {
    setTag((current) => (current === t ? '' : t));
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setTag('');
    setLanguage(allLanguages);
    setPage(1);
  };

  // New results replace the old ones in place, so bring the top of the
  // list back into view instead of leaving the user at the pagination bar.
  const goToPage = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-700">Discover</h1>
        <p className="mt-1 text-gray-500">Modules shared by the Mimir community.</p>
      </div>

      {/* Debounced search, no submit button — one search request per pause in typing. */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Input
            type="text"
            startIcon={<Search />}
            placeholder="Search modules…"
            className="pr-10"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {isFetching && !isLoading && (
            <Loader2
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
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
            {languageOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 flex min-h-7 flex-wrap items-center gap-2">
        {!isLoading && !isError && (
          <h2 className="text-sm font-semibold tracking-wide text-gray-500">
            {total === 1 ? 'Module' : 'Modules'} · {total.toLocaleString()}
          </h2>
        )}
        {tag && (
          <Badge asChild>
            <button
              type="button"
              onClick={() => handleTagClick(tag)}
              aria-label={`Remove tag filter ${tag}`}
              className="cursor-pointer"
            >
              #{tag}
              <X />
            </button>
          </Badge>
        )}
      </div>

      {isLoading ? (
        <Skeleton aria-busy="true" className="h-64 w-full rounded-3xl bg-neutral-200/70" />
      ) : isError ? (
        <StatusCard
          icon={<AlertCircle className="h-8 w-8 text-gray-400" />}
          title="Couldn't load community modules."
          description="Check your connection and try again."
          action={
            <Button size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <StatusCard
          icon={<SearchX className="h-8 w-8 text-gray-400" />}
          title={hasFilters ? 'No modules match your filters.' : 'No community modules yet.'}
          description={
            hasFilters
              ? 'Try a different search, language or tag.'
              : 'Public modules appear here once someone shares one.'
          }
          action={
            hasFilters ? (
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <CommunityCard key={m.id} hit={m} activeTag={tag} onTagClick={handleTagClick} />
          ))}
        </div>
      )}

      {!isLoading && !isError && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft size={16} className="mr-1" /> Prev
          </Button>
          <span className="min-w-24 text-center text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            Next <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      )}
    </main>
  );
}

// Same Card shell and icon treatment as the Library's module cards. The
// title link is stretched over the whole card, so the card is one click
// target while the tag chips stay separately clickable above it.
function CommunityCard({
  hit,
  activeTag,
  onTagClick,
}: {
  hit: CommunitySearchHit;
  activeTag: string;
  onTagClick: (tag: string) => void;
}) {
  const owner = hit.ownerUsername ?? 'Unknown';
  const visibleTags = hit.tags.slice(0, visibleTagCount);
  const hiddenTagCount = hit.tags.length - visibleTags.length;

  return (
    <Card className="relative h-full transition-colors hover:bg-white/90">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-emerald-100 p-2 text-emerald-700">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-semibold text-gray-900">
              <Link
                href={`/modules/${hit.id}`}
                className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-2 focus-visible:after:ring-black/20"
              >
                {hit.title}
              </Link>
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {hit.cardCount} {hit.cardCount === 1 ? 'card' : 'cards'}
              {hit.language && ` · ${hit.language}`}
            </p>
          </div>
        </div>

        {/* Fixed two-line height so cards in a row line up whether or not a description exists. */}
        <p className="line-clamp-2 min-h-10 text-sm text-gray-500">{hit.description}</p>

        {visibleTags.length > 0 && (
          <div className="relative z-10 flex flex-wrap gap-1.5">
            {visibleTags.map((tagName) => {
              const isActive = activeTag === tagName;
              return (
                <Badge key={tagName} asChild variant={isActive ? 'default' : 'outline'}>
                  <button
                    type="button"
                    onClick={() => onTagClick(tagName)}
                    aria-pressed={isActive}
                    className={
                      isActive ? 'cursor-pointer' : 'cursor-pointer text-gray-600 hover:bg-black/5'
                    }
                  >
                    #{tagName}
                  </button>
                </Badge>
              );
            })}
            {hiddenTagCount > 0 && (
              <span className="px-1 py-0.5 text-xs text-gray-400">+{hiddenTagCount}</span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-black/5 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-6 shrink-0">
              <AvatarFallback className="text-[10px]">
                {owner.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm text-gray-600">{owner}</span>
          </div>
          {/* likeCount in the search index is the number of users who saved
              (collected) the module, so it's labelled as saves. */}
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-gray-500">
            <Bookmark className="h-3.5 w-3.5" aria-hidden />
            {hit.likeCount} {hit.likeCount === 1 ? 'save' : 'saves'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Same treatment as the Library's empty state, reused for error and no-results.
function StatusCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
        {icon}
        <p className="font-semibold text-gray-800">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
        {action && <div className="mt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}
