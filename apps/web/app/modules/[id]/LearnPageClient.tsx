'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowLeft,
  Edit,
  History,
  Loader2,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import TermItem from './_components/TermItem';
import AddTerm from './_components/AddTerm';
import { Button } from '@/components/ui/button';
import { ImportFlashcardsDialog, type ImportedCard } from '@/components/import-flashcards-dialog';
import { StudyPreferencesDialog } from '@/components/StudyPreferencesDialog';
import { TestPreferencesDialog } from '@/components/TestPreferencesDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ModuleHeader from './_components/ModuleHeader';
import TermsFilterBar, {
  sortTerms,
  type SortDir,
  type SortField,
  type StatusFilter,
} from '@/components/TermsFilterBar';
import type { Term } from '@/lib/api';
import { createTerm as createTermApi, resetSetProgress } from '@/lib/api';
import { useModule, useCollectModule } from '@/lib/hooks/useModules';
import { useDueQueue } from '@/lib/hooks/useDueQueue';
import {
  useCreateTerm,
  useUpdateTerm,
  useDeleteTerm,
  useTerms,
  useToggleTermStar,
  termKeys,
} from '@/lib/hooks/useTerms';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { Input } from '@/components/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type ModeCard = {
  href: (id: string) => string;
  label: string;
  img: string;
};

const modeCards: ModeCard[] = [
  { href: (id) => `/modules/${id}/flashcards`, label: 'Flashcards', img: '/images/img3.png' },
  { href: (id) => `/modules/${id}/learn`, label: 'Learn', img: '/images/img1.png' },
  { href: (id) => `/modules/${id}/test`, label: 'Test', img: '/images/img4.png' },
];

export default function LearnPageClient({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [starredOnly, setStarredOnly] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('original');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput);
  const { data: moduleData, isLoading: moduleLoading } = useModule(id);
  // Total term count is used to decide whether to render the filter row
  // at all — an empty module doesn't need it, and it should be based on
  // the full count, not the filtered subset.
  const { data: allTerms = [] } = useTerms(id);
  const {
    data: fetchedTerms = [],
    isLoading: termsLoading,
    isFetching: termsFetching,
  } = useTerms(id, {
    starred: starredOnly ? true : undefined,
    status: status === 'all' ? undefined : status,
    q: debouncedSearch,
  });
  // Server does the filtering; we sort client-side.
  const terms = sortTerms(fetchedTerms, sortField, sortDir);
  const hasActiveFilter = starredOnly || status !== 'all' || debouncedSearch.trim().length > 0;
  const createTerm = useCreateTerm();
  const updateTerm = useUpdateTerm();
  const deleteTerm = useDeleteTerm();
  const toggleStar = useToggleTermStar(id);
  const collectModuleMutation = useCollectModule();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [testPreferencesOpen, setTestPreferencesOpen] = useState(false);

  const loading = moduleLoading || termsLoading;
  const moduleInfo = moduleData?.data;
  const isOwner = !!moduleInfo?.isOwner;
  const isCollected = !!moduleInfo?.isCollected;
  const { data: dueQueue } = useDueQueue(id, isCollected);
  const dueCount = dueQueue?.total ?? 0;

  function submitNewTerm(term: string, definition: string) {
    if (!term.trim() || !definition.trim()) {
      toast.error('Term and definition are required');
      return;
    }
    createTerm.mutate({
      term,
      definition,
      moduleId: id,
      isStarred: false,
    });
  }

  function handleDeleteTerm(termId: string) {
    deleteTerm.mutate(termId);
  }

  function submitEdit(termId: string, term: string, definition: string) {
    updateTerm.mutate({
      id: termId,
      data: { term, definition },
    });
  }

  function collectModule(moduleId: string) {
    collectModuleMutation.mutate(moduleId);
  }

  async function handleImport(cards: ImportedCard[]) {
    if (cards.length === 0) return;
    setImporting(true);
    try {
      const results = await Promise.allSettled(
        cards.map((c) =>
          createTermApi({
            moduleId: id,
            term: c.term,
            definition: c.definition,
            isStarred: false,
          }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      const created = cards.length - failed;
      if (created > 0) {
        await queryClient.invalidateQueries({
          queryKey: termKeys.listsForModule(id),
        });
        toast.success(
          `Imported ${created} ${created === 1 ? 'card' : 'cards'}${
            failed > 0 ? ` — ${failed} failed` : ''
          }.`,
        );
      } else {
        toast.error('Import failed — no cards were created.');
      }
      if (failed === 0) setImportOpen(false);
    } finally {
      setImporting(false);
    }
  }

  async function confirmReset() {
    setResetting(true);
    try {
      await resetSetProgress(id);
      await queryClient.invalidateQueries({
        queryKey: termKeys.listsForModule(id),
      });
      toast.success('Progress reset');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to reset progress');
    } finally {
      setResetting(false);
      setResetOpen(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-6 py-8 sm:px-8">
      {/* Top navigation — "Back to dashboard" belongs here, not at the
          bottom, so it's discoverable without scrolling to the end of the
          term list. History lives here too so learners can jump to
          their study record without hunting through the Settings menu. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          {isOwner && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/sets/${id}/edit`}>
                  <Edit className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            </>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link href={`/modules/${id}/sessions`}>
              <History className="h-4 w-4" />
              Session history
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <ModuleHeaderSkeleton />
      ) : moduleInfo ? (
        <ModuleHeader
          module={{
            title: moduleInfo.title,
            description: moduleInfo.description ?? '',
            termsCount: allTerms.length,
            isPrivate: moduleInfo.isPrivate,
            ownerName: moduleInfo.ownerName ?? '',
            ownerImg: moduleInfo.ownerImg ?? '',
            isOwner: moduleInfo.isOwner,
            isCollected: moduleInfo.isCollected,
          }}
        />
      ) : (
        <Card>
          <CardContent className="text-amber-800">Module not found.</CardContent>
        </Card>
      )}

      {loading ? (
        <ModeChooserSkeleton />
      ) : isCollected ? (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-neutral-700">Choose your mode</h2>
            {dueCount > 0 && (
              <Link
                href={`/modules/${id}/learn?dueFirst=1`}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1 text-sm font-semibold text-white hover:bg-brand-400"
              >
                Review {dueCount} due today →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {modeCards.map((m) => (
              <Link key={m.label} href={m.href(id)} className="group">
                <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-brand-300/20">
                  <CardContent className="flex flex-col items-center gap-3">
                    <Image src={m.img} width={120} height={120} alt={m.label} />
                    <span className="text-lg font-semibold text-neutral-800">{m.label}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="font-semibold text-neutral-900">Module not in your collection</p>
            <p className="text-sm text-neutral-600">Collect this module to start studying it.</p>
            <Button onClick={() => collectModule(id)}>Add to your library</Button>
          </CardContent>
        </Card>
      )}

      <section>
        {loading ? (
          <TermsSkeleton />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-neutral-700">Terms</h3>

              {/* Settings dropdown — collects destructive / advanced actions
                  so they don't clutter the main surface. Reset lives here
                  because it's rare and should require an extra click.
                  Rendered whenever the viewer is the owner (so Import
                  stays reachable on an empty module) or whenever there
                  is progress to manage. */}
              {(isOwner || (isCollected && allTerms.length > 0)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" aria-label="Term list settings">
                      <Settings2 className="h-4 w-4" />
                      Settings
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-56">
                    <DropdownMenuLabel>Study settings</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {isCollected && (
                      <DropdownMenuItem onClick={() => setPreferencesOpen(true)}>
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Study preferences…
                      </DropdownMenuItem>
                    )}
                    {isCollected && (
                      <DropdownMenuItem onClick={() => setTestPreferencesOpen(true)}>
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Test preferences…
                      </DropdownMenuItem>
                    )}
                    {isOwner && (
                      <DropdownMenuItem onClick={() => setImportOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Import flashcards
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href={`/modules/${id}/sessions`}>
                        <History className="mr-2 h-4 w-4" />
                        Session history
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/modules/${id}/test-history`}>
                        <History className="mr-2 h-4 w-4" />
                        Test history
                      </Link>
                    </DropdownMenuItem>
                    {isCollected && allTerms.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setResetOpen(true)}
                          className="text-rose-600 focus:bg-rose-50 focus:text-rose-600"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Reset progress
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Filter + search row. Hidden for modules with a single
                term (filtering is meaningless there) — but the search
                stays available for guest-viewed modules too, because
                the DTO-level `?q=` doesn't require a progress row. */}
            {allTerms.length > 1 && (
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                {isCollected && (
                  <TermsFilterBar
                    starredOnly={starredOnly}
                    onStarredOnlyChange={setStarredOnly}
                    sortField={sortField}
                    sortDir={sortDir}
                    onSortChange={(field, dir) => {
                      setSortField(field);
                      setSortDir(dir);
                    }}
                    status={status}
                    onStatusChange={setStatus}
                  />
                )}
                <div className="relative flex-1 sm:min-w-64">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
                  />
                  <Input
                    type="text"
                    placeholder="Search terms and definitions…"
                    className="pl-10 pr-10"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  {termsFetching && debouncedSearch && (
                    <Loader2
                      size={16}
                      className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-neutral-400"
                    />
                  )}
                </div>
              </div>
            )}

            {terms.length === 0 && hasActiveFilter ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                  <p className="font-semibold text-neutral-900">
                    {debouncedSearch
                      ? `No terms match “${debouncedSearch}”`
                      : 'No terms in this bucket'}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {debouncedSearch
                      ? 'Try a different search, or clear the filter.'
                      : 'Study more, or switch back to All.'}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {debouncedSearch && (
                      <Button variant="ghost" size="sm" onClick={() => setSearchInput('')}>
                        Clear search
                      </Button>
                    )}
                    {(starredOnly || status !== 'all') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setStarredOnly(false);
                          setStatus('all');
                        }}
                      >
                        Show all terms
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {terms.map((t: Term) => (
                  <TermItem
                    isOwned={isOwner}
                    isCollected={isCollected}
                    key={t.id}
                    term={t}
                    onDelete={() => handleDeleteTerm(t.id)}
                    onToggleStar={() => toggleStar.mutate({ id: t.id, isStarred: !t.isStarred })}
                    onSaveEdit={submitEdit}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {isOwner && <AddTerm onSubmit={submitNewTerm} isSubmitting={createTerm.isPending} />}
      </section>

      {isOwner && (
        <ImportFlashcardsDialog
          open={importOpen}
          onOpenChange={(open) => !importing && setImportOpen(open)}
          onImport={handleImport}
          isSubmitting={importing}
          closeOnSuccess={false}
        />
      )}

      {isCollected && (
        <StudyPreferencesDialog
          open={preferencesOpen}
          onOpenChange={setPreferencesOpen}
          setId={id}
        />
      )}

      {isCollected && (
        <TestPreferencesDialog
          open={testPreferencesOpen}
          onOpenChange={setTestPreferencesOpen}
          setId={id}
        />
      )}

      <Dialog open={resetOpen} onOpenChange={(open) => !resetting && setResetOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your progress?</DialogTitle>
            <DialogDescription>
              This clears your mastery status, streaks, and spaced-repetition schedule for every
              card in this module. Session history is kept. You can&apos;t undo this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReset} disabled={resetting}>
              {resetting ? 'Resetting…' : 'Reset progress'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ModuleHeaderSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64 rounded-full" />
        <Skeleton className="h-4 w-full rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </CardContent>
    </Card>
  );
}

function ModeChooserSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-3xl" />
      ))}
    </div>
  );
}

function TermsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="mb-2 h-6 w-24 rounded-full" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-3xl" />
      ))}
    </div>
  );
}
