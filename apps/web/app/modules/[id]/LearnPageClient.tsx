'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ArrowLeft, History, RotateCcw, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import TermItem from './_components/TermItem';
import AddTerm from './_components/AddTerm';
import { Button } from '@/components/ui/button';
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
import type { Term } from '@/lib/api';
import { resetSetProgress } from '@/lib/api';
import { useModule, useCollectModule } from '@/lib/hooks/useModules';
import {
  useCreateTerm,
  useUpdateTerm,
  useDeleteTerm,
  useTerms,
  useToggleTermStar,
  termKeys,
} from '@/lib/hooks/useTerms';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function LearnPageClient({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: moduleData, isLoading: moduleLoading } = useModule(id);
  const { data: terms = [], isLoading: termsLoading } = useTerms(id);
  const createTerm = useCreateTerm();
  const updateTerm = useUpdateTerm();
  const deleteTerm = useDeleteTerm();
  const toggleStar = useToggleTermStar(id);
  const collectModuleMutation = useCollectModule();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loading = moduleLoading || termsLoading;
  const moduleInfo = moduleData?.data;
  const isOwner = !!moduleInfo?.isOwner;
  const isCollected = !!moduleInfo?.isCollected;

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

  async function confirmReset() {
    setResetting(true);
    try {
      await resetSetProgress(id);
      await queryClient.invalidateQueries({ queryKey: termKeys.list(id) });
      toast.success('Progress reset');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to reset progress');
    } finally {
      setResetting(false);
      setResetOpen(false);
    }
  }

  return (
    <main className="flex flex-col items-center min-h-screen bg-gray-50 relative p-8 pb-20">
      {/* Top navigation — "Back to dashboard" belongs here, not at the
          bottom, so it's discoverable without scrolling to the end of the
          term list. History lives here too so learners can jump to
          their study record without hunting through the Settings menu. */}
      <div className="w-full max-w-4xl mb-6 flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-x-2 text-sm text-gray-500 hover:text-[#4255FF] hover:underline underline-offset-4 transition"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <Link
          href={`/modules/${id}/sessions`}
          className="inline-flex items-center gap-x-1.5 text-sm text-gray-500 hover:text-[#4255FF] hover:underline underline-offset-4 transition"
        >
          <History size={16} /> Session history
        </Link>
      </div>

      <div className="w-full max-w-4xl mb-8">
        {loading ? (
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <div>
                <Skeleton className="h-10 w-52 bg-gray-200 mb-3" />
                <Skeleton className="h-5 w-72 bg-gray-200" />
              </div>
              <div className="flex gap-x-4 items-center">
                <Skeleton className="size-10 rounded-full bg-gray-200 mt-4" />
                <Skeleton className="h-5 w-24 bg-gray-200 mt-4" />
              </div>
            </div>
            <div className="space-y-4 my-10">
              <div className="flex gap-x-4">
                <Skeleton className="h-5 w-30 bg-gray-200" />
                <Skeleton className="h-5 w-30 bg-gray-200" />
                <Skeleton className="h-5 w-30 bg-gray-200" />
              </div>
              <Skeleton className="h-5 w-full bg-gray-200" />
            </div>
          </div>
        ) : moduleInfo ? (
          <ModuleHeader
            module={{
              title: moduleInfo.title,
              description: moduleInfo.description ?? '',
              termsCount: terms.length,
              isPrivate: moduleInfo.isPrivate,
              ownerName: moduleInfo.ownerName ?? '',
              ownerImg: moduleInfo.ownerImg ?? '',
              isOwner: moduleInfo.isOwner,
              isCollected: moduleInfo.isCollected,
            }}
          />
        ) : (
          <div className="p-6 bg-yellow-50 text-yellow-800 rounded-2xl">
            Module not found
          </div>
        )}
      </div>

      <hr className="w-full max-w-4xl mb-8 border-gray-300" />

      {loading ? (
        <div className="w-full max-w-4xl space-y-4 flex flex-col items-center">
          <Skeleton className="w-1/4 h-10 bg-gray-200 mb-3" />
          <Skeleton className="w-full h-40 bg-gray-200 mb-3" />
        </div>
      ) : isCollected ? (
        <>
          <h2 className="text-2xl font-semibold mb-6">Choose your mode</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
            <Link href={`/modules/${id}/flashcards`}>
              <Card className="bg-white rounded-2xl p-5 text-xl font-semibold hover:shadow-md flex flex-col items-center cursor-pointer">
                <Image src="/images/img3.png" width={150} height={150} alt="Flashcards" />
                Flashcards
              </Card>
            </Link>

            <Link href={`/modules/${id}/quiz`}>
              <Card className="bg-white rounded-2xl p-5 text-xl font-semibold hover:shadow-md flex flex-col items-center cursor-pointer">
                <Image src="/images/img1.png" width={150} height={150} alt="Quiz" />
                Quiz
              </Card>
            </Link>

            <Link href={`/modules/${id}/test`}>
              <Card className="bg-white rounded-2xl p-5 text-xl font-semibold hover:shadow-md flex flex-col items-center cursor-pointer">
                <Image src="/images/img4.png" width={150} height={150} alt="Test" />
                Test
              </Card>
            </Link>
          </div>
        </>
      ) : (
        <Card className="bg-yellow-50 text-yellow-800 w-full max-w-4xl">
          <CardHeader className="text-lg font-semibold">
            Module not collected
          </CardHeader>
          <CardContent>
            You need to collect this module to start learning. Go back to the
            dashboard and collect it first.
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => collectModule(id)}
            >
              Add to Collected Modules
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="w-full max-w-4xl mt-10">
        {loading ? (
          <div>
            <Skeleton className="h-10 w-48 bg-gray-200 mb-4 rounded-xl" />
            <Skeleton className="h-16 w-full bg-gray-200 mb-4 rounded-xl" />
            <Skeleton className="h-16 w-full bg-gray-200 mb-4 rounded-xl" />
            <Skeleton className="h-16 w-full bg-gray-200 mb-4 rounded-xl" />
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-semibold text-[#4255FF]">Terms</h3>

              {/* Settings dropdown — collects destructive / advanced actions
                  so they don't clutter the main surface. Reset lives here
                  because it's rare and should require an extra click. */}
              {isCollected && terms.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                      aria-label="Term list settings"
                    >
                      <Settings2 size={16} />
                      Settings
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-56">
                    <DropdownMenuLabel>Study settings</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/modules/${id}/sessions`}>
                        <History size={16} className="mr-2" />
                        Session history
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setResetOpen(true)}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <RotateCcw size={16} className="mr-2" />
                      Reset progress
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="space-y-3">
              {terms.map((t: Term) => (
                <TermItem
                  isOwned={isOwner}
                  isCollected={isCollected}
                  key={t.id}
                  term={t}
                  onDelete={() => handleDeleteTerm(t.id)}
                  onToggleStar={() =>
                    toggleStar.mutate({ id: t.id, isStarred: !t.isStarred })
                  }
                  onSaveEdit={submitEdit}
                />
              ))}
            </div>
          </>
        )}

        {isOwner && (
          <AddTerm onSubmit={submitNewTerm} isSubmitting={createTerm.isPending} />
        )}
      </div>

      <Dialog open={resetOpen} onOpenChange={(open) => !resetting && setResetOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your progress?</DialogTitle>
            <DialogDescription>
              This clears your mastery status, streaks, and spaced-repetition
              schedule for every card in this module. Session history is kept.
              You can&apos;t undo this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmReset}
              disabled={resetting}
              className="bg-red-600 hover:bg-red-700"
            >
              {resetting ? 'Resetting…' : 'Reset progress'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
