'use client';

/**
 * Global search input in the navbar.
 *
 * Built on shadcn <Command /> (cmdk). Sections:
 *   1. Pages    — hand-curated catalog (Settings, Library…)
 *   2. Folders  — client-side match over the user's folders
 *   3. Modules  — user's library sets (client-side filter)
 *   4. Cards    — GET /flashcards/search
 *   5. Community — GET /search/sets (Elasticsearch)
 *
 * cmdk owns arrow/enter/escape nav + focus management; we own outside-click
 * close (since we render inline rather than in a Dialog) and the Cmd/Ctrl+K
 * global focus shortcut. Filtering is done in the hooks — cmdk's internal
 * filter is disabled via shouldFilter={false} to avoid double-filtering.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  FileText,
  Folder as FolderIcon,
  Globe,
  Layers,
  Search,
  Settings,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { useFlashcardSearch } from '@/lib/hooks/useFlashcardSearch';
import { useCommunityModules } from '@/lib/hooks/useModules';
import { useFolders, useLibrarySets } from '@/lib/hooks/useLibrary';
import { Input } from './ui/input';

const LIMIT = 5;
const minLengthForRemote = 2;

// -----------------------------------------------------------------------------
// Static pages catalog
// -----------------------------------------------------------------------------

interface PageEntry {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const PAGES: PageEntry[] = [
  {
    path: '/account',
    title: 'Account settings',
    description: 'Profile, security, preferences, connected accounts',
    keywords: [
      'account',
      'settings',
      'preferences',
      'profile',
      'password',
      'security',
      'timezone',
      'language',
      'sessions',
      'google',
      'delete account',
    ],
    icon: Settings,
  },
  {
    path: '/library',
    title: 'Library',
    description: 'Your modules and folders',
    keywords: ['library', 'modules', 'my modules', 'sets', 'folders', 'mine'],
    icon: BookOpen,
  },
  {
    path: '/discover',
    title: 'Discover',
    description: 'Browse public community modules',
    keywords: ['discover', 'browse', 'community', 'public', 'explore'],
    icon: Globe,
  },
  {
    path: '/srs',
    title: 'Review',
    description: 'Spaced-repetition queue for today',
    keywords: ['review', 'srs', 'spaced', 'reminders', 'today', 'queue', 'due'],
    icon: Layers,
  },
];

const includes = (q: string, ...hs: (string | null | undefined)[]) =>
  Boolean(q) && hs.some((h) => (h ?? '').toLowerCase().includes(q.toLowerCase()));

// Platform-detect without SSR mismatch or an effect-driven setState.
// useSyncExternalStore returns the server snapshot during SSR + the
// initial client render, then swaps to the real snapshot on the
// commit that follows hydration — no cascading render.
const neverSubscribe = () => () => {};
const serverShortcut = () => 'Ctrl K';
const clientShortcut = () => (/Mac|iPhone|iPod|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K');

function useShortcutLabel(): string {
  return useSyncExternalStore(neverSubscribe, clientShortcut, serverShortcut);
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function GlobalSearch() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(value, 200);
  const shortcut = useShortcutLabel();
  const q = debounced.trim();

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const library = useLibrarySets();
  const folders = useFolders();
  const cards = useFlashcardSearch({ q: debounced, limit: LIMIT });
  const community = useCommunityModules({ q: debounced, page: 1, limit: LIMIT });

  const pageMatches = useMemo(
    () => (q ? PAGES.filter((p) => includes(q, p.title, ...p.keywords)).slice(0, 4) : []),
    [q],
  );
  const folderMatches = useMemo(
    () =>
      q
        ? (folders.data ?? []).filter((f) => includes(q, f.name, f.description)).slice(0, LIMIT)
        : [],
    [q, folders.data],
  );
  const myModuleMatches = useMemo(
    () =>
      q
        ? (library.data ?? [])
            .filter((s) => includes(q, s.title, s.description, s.language))
            .slice(0, LIMIT)
        : [],
    [q, library.data],
  );
  const cardHits = cards.data?.items ?? [];
  const communityHits = community.data?.items ?? [];
  const hasAny =
    pageMatches.length +
      folderMatches.length +
      myModuleMatches.length +
      cardHits.length +
      communityHits.length >
    0;
  const showSeeAll = q.length >= minLengthForRemote;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!q) return;
    go(`/discover?q=${encodeURIComponent(q)}`);
  };

  const showDropdown = open && value.trim().length > 0;

  return (
    <div ref={rootRef} className="relative hidden max-w-2xl flex-1 md:block">
      {/* cmdk handles keyboard nav across CommandItems on its own. We do NOT
          wire `value`/`onValueChange` here — on <Command> those track the
          highlighted item, not the input text, so binding them to our input
          state made hover replace the query with e.g. "folder:<id>". Filtering
          is done manually in the hooks, hence shouldFilter={false}. Also
          strip the wrapper's rounded-md/overflow-hidden so the pill-shaped
          <Input> inside isn't clipped to a smaller radius. */}
      <Command shouldFilter={false} className="overflow-visible rounded-none bg-transparent">
        <form onSubmit={handleSubmit} role="search">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search modules, cards, settings…"
            aria-label="Search"
            className="h-11 w-full rounded-full border border-black/5 bg-white pl-11 pr-16 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors hover:border-black/10 focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-300/40"
          />
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none border border-black/5 bg-neutral-50 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium text-neutral-500 sm:inline-block"
          >
            {shortcut}
          </kbd>
        </form>

        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-black/5 bg-white/95 shadow-xl backdrop-blur-md">
            <CommandList>
              {!hasAny && !cards.isFetching && !community.isFetching && (
                <CommandEmpty>No matches for &ldquo;{q}&rdquo;</CommandEmpty>
              )}

              {pageMatches.length > 0 && (
                <CommandGroup heading="Pages">
                  {pageMatches.map((p) => {
                    const Icon = p.icon;
                    return (
                      <Row
                        key={p.path}
                        value={`page:${p.path}`}
                        onSelect={() => go(p.path)}
                        icon={<Icon className="h-4 w-4" />}
                        title={p.title}
                        badge="Page"
                        subtitle={p.description}
                        trailing={
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-brand-500/60" />
                        }
                      />
                    );
                  })}
                </CommandGroup>
              )}

              {folderMatches.length > 0 && (
                <CommandGroup heading="Folders">
                  {folderMatches.map((f) => (
                    <Row
                      key={f.id}
                      value={`folder:${f.id}`}
                      onSelect={() => go(`/library/folders/${f.id}`)}
                      icon={<FolderIcon className="h-4 w-4" />}
                      title={<Highlight text={f.name} needle={q} />}
                      badge="Folder"
                      subtitle={f.description && <Highlight text={f.description} needle={q} />}
                      tail={`${f.studySets?.length ?? 0} module${f.studySets?.length === 1 ? '' : 's'}`}
                    />
                  ))}
                </CommandGroup>
              )}

              {myModuleMatches.length > 0 && (
                <CommandGroup heading="Your modules">
                  {myModuleMatches.map((s) => (
                    <Row
                      key={s.id}
                      value={`my-module:${s.id}`}
                      onSelect={() => go(`/modules/${s.id}`)}
                      icon={<Layers className="h-4 w-4" />}
                      title={
                        <>
                          <Highlight text={s.title} needle={q} />
                          {s.visibility === 'PRIVATE' && (
                            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                              Private
                            </span>
                          )}
                        </>
                      }
                      badge="Module"
                      subtitle={s.description && <Highlight text={s.description} needle={q} />}
                      tail={
                        [s.isOwner ? 'Owned' : s.isFavourited ? 'Collected' : '', s.language]
                          .filter(Boolean)
                          .join(' · ') || undefined
                      }
                    />
                  ))}
                </CommandGroup>
              )}

              {cardHits.length > 0 && (
                <CommandGroup heading="Cards">
                  {cardHits.map((c) => (
                    <Row
                      key={c.id}
                      value={`card:${c.id}`}
                      onSelect={() => go(`/modules/${c.studySetId}`)}
                      icon={<FileText className="h-4 w-4" />}
                      title={<Highlight text={c.term} needle={q} />}
                      badge="Card"
                      subtitle={<Highlight text={c.definition} needle={q} />}
                      tail={`in ${c.studySetTitle}`}
                    />
                  ))}
                </CommandGroup>
              )}

              {communityHits.length > 0 && (
                <CommandGroup heading="Community modules">
                  {communityHits.map((m) => (
                    <Row
                      key={m.id}
                      value={`community:${m.id}`}
                      onSelect={() => go(`/modules/${m.id}`)}
                      icon={<Globe className="h-4 w-4" />}
                      title={m.title}
                      badge="Community"
                      subtitle={m.description ?? undefined}
                      tail={
                        `${m.cardCount} ${m.cardCount === 1 ? 'card' : 'cards'}` +
                        (m.ownerUsername ? ` · by ${m.ownerUsername}` : '')
                      }
                    />
                  ))}
                </CommandGroup>
              )}

              {showSeeAll && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value={`see-all:${q}`}
                      onSelect={() => go(`/discover?q=${encodeURIComponent(q)}`)}
                      className="font-medium text-brand-600"
                    >
                      <Search className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate text-sm">
                        Search Discover for &ldquo;{q}&rdquo;
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </div>
        )}
      </Command>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Row + Highlight — shared shell across every section
// -----------------------------------------------------------------------------

const iconBox = 'mt-0.5 shrink-0 rounded-md bg-brand-500/10 p-1.5 text-brand-500';

function Row({
  value,
  onSelect,
  icon,
  title,
  badge,
  subtitle,
  tail,
  trailing,
}: {
  value: string;
  onSelect: () => void;
  icon: React.ReactNode;
  title: React.ReactNode;
  badge: string;
  subtitle?: React.ReactNode;
  tail?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <CommandItem value={value} onSelect={onSelect}>
      <div className={iconBox}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
          <Badge
            variant="outline"
            className="rounded border-transparent bg-brand-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-brand-600"
          >
            {badge}
          </Badge>
        </div>
        {subtitle && <p className="line-clamp-1 text-xs text-gray-500">{subtitle}</p>}
        {tail && <p className="mt-0.5 truncate text-[11px] text-gray-400">{tail}</p>}
      </div>
      {trailing}
    </CommandItem>
  );
}

function Highlight({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-brand-500/20 px-0.5 text-gray-900">
        {text.slice(idx, idx + needle.length)}
      </mark>
      {text.slice(idx + needle.length)}
    </>
  );
}
