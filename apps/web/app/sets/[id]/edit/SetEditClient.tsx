"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Globe, Layers, Loader2, Lock, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useDeleteModule,
  useModule,
  useUpdateModule,
} from "@/lib/hooks/useModules";

interface Props {
  id: string;
}

export default function SetEditClient({ id }: Props) {
  const router = useRouter();
  const { data: envelope, isLoading, isError } = useModule(id);
  const module = envelope?.data;
  const updateModule = useUpdateModule();
  const deleteModule = useDeleteModule();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Seed form from server data once loaded. `module.id` in the dep list
  // keeps re-fetches from clobbering in-progress edits.
  useEffect(() => {
    if (!module) return;
    setTitle(module.title);
    setDescription(module.description ?? "");
    setIsPrivate(module.isPrivate);
    // `language` isn't on StudySetResponseDto (yet) — fall back to empty.
    setLanguage("");
  }, [module?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-10 w-64 rounded bg-gray-100" />
        <Skeleton className="mt-6 h-64 w-full rounded bg-gray-100" />
      </main>
    );
  }

  if (isError || !module) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-gray-500">Module not found.</p>
        <Button asChild variant="ghost" className="mt-3">
          <Link href="/library">← Back to library</Link>
        </Button>
      </main>
    );
  }

  if (!module.isOwner) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-gray-800 font-semibold">
          You can&apos;t edit this module.
        </p>
        <p className="text-sm text-gray-500">
          Only the owner can change a module&apos;s details.
        </p>
        <Button asChild variant="ghost" className="mt-3">
          <Link href={`/modules/${id}`}>← Back to module</Link>
        </Button>
      </main>
    );
  }

  const dirty =
    title.trim() !== module.title ||
    description.trim() !== (module.description ?? "") ||
    isPrivate !== module.isPrivate;

  const canSave = title.trim().length > 0 && dirty && !updateModule.isPending;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await updateModule.mutateAsync({
        id,
        data: {
          title: title.trim(),
          description: description.trim(),
          isPrivate,
          ...(language.trim() ? { language: language.trim() } : {}),
        },
      });
      router.push(`/modules/${id}`);
    } catch (err) {
      toast.error((err as Error).message || "Failed to save changes");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteModule.mutateAsync(id);
      router.push("/library");
    } catch (err) {
      toast.error((err as Error).message || "Failed to delete module");
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/modules/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#4255FF]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to module
        </Link>
      </div>

      <h1 className="mb-6 text-3xl font-bold text-[#4255FF]">Edit module</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-11 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4255FF]/40 focus:border-[#4255FF] text-base"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-[#4255FF]/40 focus:border-[#4255FF] text-base leading-relaxed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              Language <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="e.g. Spanish"
              className="w-full h-11 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4255FF]/40 focus:border-[#4255FF] text-base"
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 block">
              Visibility
            </span>
            <div
              role="radiogroup"
              aria-label="Visibility"
              className="grid grid-cols-2 gap-2"
            >
              <VisibilityOption
                selected={!isPrivate}
                onClick={() => setIsPrivate(false)}
                icon={<Globe size={16} />}
                label="Public"
                hint="Anyone can find and save it."
              />
              <VisibilityOption
                selected={isPrivate}
                onClick={() => setIsPrivate(true)}
                icon={<Lock size={16} />}
                label="Private"
                hint="Only you can see it."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Flashcards</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {module.flashcardsCount ?? 0} card
            {(module.flashcardsCount ?? 0) === 1 ? "" : "s"}. Edit them on the
            module page.
          </p>
          <Button asChild variant="outline">
            <Link href={`/modules/${id}`} className="inline-flex items-center gap-2">
              <Layers className="h-4 w-4" /> Manage cards
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6 border-red-100">
        <CardHeader>
          <CardTitle className="text-lg text-red-600">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Delete module</p>
            <p className="text-xs text-gray-500">
              Removes the module and all its cards. Not reversible.
            </p>
          </div>
          <Button
            variant="outline"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => router.push(`/modules/${id}`)}
          disabled={updateModule.isPending}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave} className="min-w-32">
          {updateModule.isPending ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this module?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            This removes the module and all its cards from your library. This
            action can&apos;t be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteModule.isPending}
              onClick={handleDelete}
            >
              {deleteModule.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function VisibilityOption({
  selected,
  onClick,
  icon,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "text-left rounded-lg border p-3 transition-colors",
        selected
          ? "border-[#4255FF] bg-[#4255FF]/5 text-[#4255FF]"
          : "border-gray-200 hover:border-gray-300 text-gray-700",
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        {icon}
        {label}
      </div>
      <div className="text-xs text-gray-500 mt-1">{hint}</div>
    </button>
  );
}
