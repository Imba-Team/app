'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Folder as FolderIcon,
  Layers,
  Plus,
  Search,
  SearchX,
  Star,
  User,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useCreateModuleDialog } from '@/contexts/CreateModuleDialogContext';
import type { Folder, LibraryItem } from '@/lib/api';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { useFolders, useLibrarySets } from '@/lib/hooks/useLibrary';
import {
  useFlashcardSearch,
  type FlashcardSearchHit,
} from '@/lib/hooks/useFlashcardSearch';

import { NewFolderDialog } from './_components/NewFolderDialog';

type Filter = 'all' | 'owned' | 'favourited' | 'folders';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'owned', label: 'Owned' },
  { id: 'favourited', label: 'Favourited' },
  { id: 'folders', label: 'Folders' },
];

export default function LibraryPage() {
  const router = useRouter();
  const createModule = useCreateModuleDialog();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const sets = useLibrarySets();
  const folders = useFolders();
  const cardSearch = useFlashcardSearch({ q: debouncedSearch, limit: 10 });

  const q = debouncedSearch.trim().toLowerCase();

  const filteredSets = useMemo(() => {
    const list = sets.data ?? [];
    return list
      .filter((s) => (filter === 'owned' ? s.isOwner : true))
      .filter((s) => (filter === 'favourited' ? s.isFavourited && !s.isOwner : true))
      .filter((s) =>
        q
          ? s.title.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q)
          : true,
      );
  }, [sets.data, filter, q]);

  const filteredFolders = useMemo(() => {
    const list = folders.data ?? [];
    return list.filter((f) =>
      q
        ? f.name.toLowerCase().includes(q) || (f.description ?? '').toLowerCase().includes(q)
        : true,
    );
  }, [folders.data, q]);

  const showFolders = filter === 'all' || filter === 'folders';
  const showSets = filter !== 'folders';

  const isLoading = sets.isLoading || folders.isLoading;

  const isEmpty =
    !isLoading &&
    (showSets ? filteredSets.length === 0 : true) &&
    (showFolders ? filteredFolders.length === 0 : true);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-neutral-700">Library</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}>
            <FolderIcon className="mr-1 h-4 w-4" /> New folder
          </Button>
          <Button size="sm" onClick={() => createModule.open()}>
            <Plus className="mr-1 h-4 w-4" /> New module
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Input
          startIcon={<Search />}
          placeholder="Search library…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-sm transition cursor-pointer ${
              filter === f.id
                ? 'bg-brand-300 text-neutral-700 hover:text-neutral-950 hover:bg-brand-400 '
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          searching={q.length > 0}
          filter={filter}
          onCreateModule={() => createModule.open()}
        />
      ) : (
        <div className="space-y-8">
          {showFolders && filteredFolders.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500">
                Folders · {filteredFolders.length}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredFolders.map((f) => (
                  <FolderCard
                    key={f.id}
                    folder={f}
                    onClick={() => router.push(`/library/folders/${f.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {showSets && filteredSets.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500">
                Modules · {filteredSets.length}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredSets.map((s) => (
                  <SetCard key={s.id} set={s} onClick={() => router.push(`/modules/${s.id}`)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Card matches — appears once the query is long enough to be
          meaningful. Distinct from the client-side title filter above
          so users can find a card by its content even if the parent
          set's title doesn't match. */}
      {q.length >= 2 && (cardSearch.data?.items?.length ?? 0) > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500">
            Card matches · {cardSearch.data?.total ?? 0}
          </h2>
          <div className="space-y-2">
            {cardSearch.data?.items.map((card) => (
              <CardMatchRow
                key={card.id}
                card={card}
                query={debouncedSearch.trim()}
                onOpen={() => router.push(`/modules/${card.studySetId}`)}
              />
            ))}
          </div>
        </section>
      )}

      <NewFolderDialog open={newFolderOpen} onOpenChange={setNewFolderOpen} />
    </main>
  );
}

function FolderCard({ folder, onClick }: { folder: Folder; onClick: () => void }) {
  const count = folder.studySets?.length ?? 0;
  return (
    <Card onClick={onClick} className="cursor-pointer">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-md bg-brand-500/10 p-2 text-brand-500">
          <FolderIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">{folder.name}</p>
          {folder.description && (
            <p className="truncate text-sm text-gray-500">{folder.description}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {count} module{count === 1 ? '' : 's'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SetCard({ set, onClick }: { set: LibraryItem; onClick: () => void }) {
  return (
    <Card onClick={onClick} className="cursor-pointer">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-md bg-emerald-100 p-2 text-emerald-700">
          <Layers className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-gray-900">{set.title}</p>
            {set.visibility === 'PRIVATE' && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                Private
              </span>
            )}
          </div>
          {set.description && <p className="truncate text-sm text-gray-500">{set.description}</p>}
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
            {set.isOwner ? (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" /> Owned
              </span>
            ) : set.isFavourited ? (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3" /> Collected
              </span>
            ) : null}
            {set.language && <span>· {set.language}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CardMatchRow({
  card,
  query,
  onOpen,
}: {
  card: FlashcardSearchHit;
  query: string;
  onOpen: () => void;
}) {
  return (
    <Card onClick={onOpen} className="cursor-pointer">
      <CardContent className="flex items-start gap-3 p-3">
        <div className="mt-0.5 rounded-md bg-brand-500/10 p-2 text-brand-500">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-800">
            <Highlight text={card.term} needle={query} />
          </p>
          <p className="line-clamp-2 text-xs text-gray-500">
            <Highlight text={card.definition} needle={query} />
          </p>
          <p className="mt-1 truncate text-[11px] text-gray-400">
            in {card.studySetTitle}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Highlight({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const lower = text.toLowerCase();
  const q = needle.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-yellow-100 px-0.5 text-gray-900">
        {text.slice(idx, idx + needle.length)}
      </mark>
      {text.slice(idx + needle.length)}
    </>
  );
}

function EmptyState({
  searching,
  filter,
  onCreateModule,
}: {
  searching: boolean;
  filter: Filter;
  onCreateModule: () => void;
}) {
  const router = useRouter();
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
        <SearchX className="h-8 w-8 text-gray-400" />
        <p className="font-semibold text-gray-800">
          {searching
            ? 'Nothing matches that search.'
            : filter === 'folders'
              ? 'No folders yet.'
              : filter === 'favourited'
                ? "You haven't collected anything yet."
                : 'Your library is empty.'}
        </p>
        <p className="text-sm text-gray-500">
          {filter === 'folders'
            ? 'Folders group modules together — create one to keep things tidy.'
            : 'Create a module or browse the community to fill your library.'}
        </p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={onCreateModule}>
            New module
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push('/discover')}>
            Browse discover
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
