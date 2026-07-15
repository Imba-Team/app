"use client";
import Image from "next/image";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import TermItem from "./_components/TermItem";
import AddTerm from "./_components/AddTerm";
import { Button } from "@/components/ui/button";
import ModuleHeader from "./_components/ModuleHeader";
import type { Term } from "./types";
import { useModule } from "@/lib/hooks/useModules";
import {
  useCreateTerm,
  useUpdateTerm,
  useDeleteTerm,
  useUpdateTermProgress,
} from "@/lib/hooks/useTerms";
import { toast } from "sonner";

export default function LearnPageClient({ id }: { id: string }) {
  const { data: moduleData, isLoading: moduleLoading } = useModule(id);
  const createTerm = useCreateTerm();
  const updateTerm = useUpdateTerm();
  const deleteTerm = useDeleteTerm();
  const updateTermProgress = useUpdateTermProgress(id);

  const loading = moduleLoading;

  async function toggleStar(term: Term) {
    try {
      await updateTermProgress.mutateAsync({
        id: term.id,
        data: {
          isStarred: !term.isStarred,
        },
      });
      // window.location.reload();
    } catch (error) {
      console.error("toggle star error", error);
      toast.error("Failed to toggle star");
    }
  }

  function submitNewTerm(term: string, definition: string) {
    if (!term.trim() || !definition.trim()) {
      toast.error("Term and definition are required");
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

  async function collectModule(moduleId: string) {
    try {
      const res = await fetch(
        `https://imba-server.up.railway.app/v2/modules/${moduleId}/collect`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Module collected!");
      // Refetch the module data
      window.location.reload();
    } catch (err) {
      console.error("collect module error", err);
      toast.error("Failed to collect module");
    }
  }

  async function handleResetProgress() {
    if (!moduleInfo?.terms || moduleInfo.terms.length === 0) {
      toast.error("No terms to reset");
      return;
    }

    try {
      const resetPromises = moduleInfo.terms.map((term: Term) =>
        updateTermProgress.mutateAsync({
          id: term.id,
          data: { status: "not_started" },
        })
      );

      await Promise.all(resetPromises);
      toast.success("Progress reset successfully!");
      // Refetch the module data to update progress bar
      window.location.reload();
    } catch (err) {
      console.error("reset progress error", err);
      toast.error("Failed to reset progress");
    }
  }

  const moduleInfo = moduleData?.data;
  const error = null; // Remove old error state since queries handle errors

  return (
    <main className="flex flex-col items-center min-h-screen bg-gray-50 relative p-8 pb-20">
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

              <Skeleton className="h-5 w-full bg-gray-200 " />
            </div>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 text-red-700 rounded-2xl">{error}</div>
        ) : moduleInfo ? (
          <ModuleHeader
            module={moduleInfo}
            // onResetProgress={handleResetProgress}
            // isCollected={!!moduleInfo.isCollected}
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
      ) : moduleInfo?.isCollected ? (
        <>
          <h2 className="text-2xl font-semibold mb-6">Choose your mode</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
            <Link href={`/modules/${id}/flashcards`}>
              <Card className="bg-white rounded-2xl p-5 text-xl font-semibold hover:shadow-md flex flex-col items-center cursor-pointer">
                <Image
                  src="/images/img3.png"
                  width={150}
                  height={150}
                  alt="Flashcards"
                />
                Flashcards
              </Card>
            </Link>

            <Link href={`/modules/${id}/quiz`}>
              <Card className="bg-white rounded-2xl p-5 text-xl font-semibold hover:shadow-md flex flex-col items-center cursor-pointer">
                <Image
                  src="/images/img1.png"
                  width={150}
                  height={150}
                  alt="Quiz"
                />
                Quiz
              </Card>
            </Link>

            <Link href={`/modules/${id}/test`}>
              <Card className="bg-white rounded-2xl p-5 text-xl font-semibold hover:shadow-md flex flex-col items-center cursor-pointer">
                <Image
                  src="/images/img4.png"
                  width={150}
                  height={150}
                  alt="Test"
                />
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
            <div className="flex justify-between items-center mb-4 ">
              <h3 className="text-2xl font-semibold text-[#4255FF]">Terms</h3>
              {moduleInfo?.isCollected &&
                moduleInfo.progress &&
                moduleInfo.termsCount > 0 &&
                handleResetProgress && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetProgress}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw size={16} />
                    Reset Progress
                  </Button>
                )}
            </div>
            <div className="space-y-3">
              {moduleInfo.terms.map((t: Term) => (
                <TermItem
                  isOwned={!!moduleData?.data?.isOwner}
                  isCollected={!!moduleData?.data?.isCollected}
                  key={t.id}
                  term={t}
                  onDelete={() => handleDeleteTerm(t.id)}
                  onToggleStar={() => toggleStar(t)}
                  onSaveEdit={submitEdit}
                />
              ))}
            </div>
          </>
        )}

        {moduleInfo?.isOwner && <AddTerm onSubmit={submitNewTerm} />}
      </div>
      <Link href="/dashboard" className="mt-10">
        <span className="flex items-center gap-x-2 hover:underline underline-offset-4 hover:text-[#4255FF] transition">
          <ArrowLeft size={20} /> Back to dashboard
        </span>
      </Link>
    </main>
  );
}
