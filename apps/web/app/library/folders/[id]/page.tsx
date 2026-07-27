"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit2,
  Layers,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import {
  useAddSetsToFolder,
  useDeleteFolder,
  useFolder,
  useLibrarySets,
  useRemoveSetFromFolder,
  useUpdateFolder,
} from "@/lib/hooks/useLibrary";

export default function FolderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const folder = useFolder(id);
  const sets = useLibrarySets();

  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const addSets = useAddSetsToFolder();
  const removeSet = useRemoveSetFromFolder();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState(false);

  if (folder.isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="h-10 w-64 rounded bg-gray-100" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg bg-gray-100" />
          ))}
        </div>
      </main>
    );
  }

  if (folder.isError || !folder.data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-gray-500">Folder not found.</p>
        <Button asChild variant="ghost" className="mt-3">
          <Link href="/library">← Back to library</Link>
        </Button>
      </main>
    );
  }

  const f = folder.data;
  const containedIds = new Set((f.studySets ?? []).map((s) => s.id));
  const addableSets = (sets.data ?? []).filter((s) => !containedIds.has(s.id));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/library"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" /> Library
          </Link>
          <h1 className="truncate text-3xl font-bold text-brand-500">
            {f.name}
          </h1>
          {f.description && (
            <p className="mt-1 text-sm text-gray-600">{f.description}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Edit2 className="mr-1 h-4 w-4" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Modules · {f.studySets?.length ?? 0}
        </h2>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add modules
        </Button>
      </div>

      {(f.studySets?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="font-semibold text-gray-800">Empty folder.</p>
            <p className="text-sm text-gray-500">
              Add modules to keep them grouped.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {f.studySets?.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-md bg-emerald-100 p-2 text-emerald-700">
                  <Layers className="h-5 w-5" />
                </div>
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => router.push(`/modules/${s.id}`)}
                >
                  <p className="truncate font-semibold text-gray-900 hover:underline">
                    {s.title}
                  </p>
                  {s.description && (
                    <p className="truncate text-sm text-gray-500">
                      {s.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-red-600"
                  disabled={removeSet.isPending}
                  onClick={() =>
                    removeSet.mutate({ folderId: f.id, studySetId: s.id })
                  }
                  title="Remove from folder"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EditFolderDialog
        open={editing}
        onOpenChange={setEditing}
        folder={{ id: f.id, name: f.name, description: f.description ?? "" }}
        onSubmit={(data) =>
          updateFolder.mutateAsync({ id: f.id, data }).then(() => setEditing(false))
        }
        isPending={updateFolder.isPending}
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this folder?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            The modules inside stay in your library — only the folder is
            removed.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteFolder.isPending}
              onClick={async () => {
                await deleteFolder.mutateAsync(f.id);
                router.push("/library");
              }}
            >
              {deleteFolder.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddSetsDialog
        open={adding}
        onOpenChange={setAdding}
        addableSets={addableSets}
        loading={sets.isLoading}
        submitting={addSets.isPending}
        onAdd={async (ids) => {
          if (ids.length === 0) return;
          await addSets.mutateAsync({ folderId: f.id, studySetIds: ids });
          setAdding(false);
        }}
      />
    </main>
  );
}

function EditFolderDialog({
  open,
  onOpenChange,
  folder,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: { id: string; name: string; description: string };
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
  isPending: boolean;
}) {
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setName(folder.name);
          setDescription(folder.description);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            maxLength={120}
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            maxLength={400}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={name.trim().length < 2 || isPending}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                description: description.trim() || undefined,
              })
            }
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddSetsDialog({
  open,
  onOpenChange,
  addableSets,
  loading,
  submitting,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addableSets: {
    id: string;
    title: string;
    description?: string | null;
  }[];
  loading: boolean;
  submitting: boolean;
  onAdd: (ids: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setSelected(new Set());
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add modules</DialogTitle>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-gray-500">Loading…</p>
          ) : addableSets.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">
              Nothing left to add — every module in your library is already
              here.
            </p>
          ) : (
            <ul className="space-y-1">
              {addableSets.map((s) => {
                const checked = selected.has(s.id);
                return (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.id)}
                        className="h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-800">
                          {s.title}
                        </p>
                        {s.description && (
                          <p className="truncate text-xs text-gray-500">
                            {s.description}
                          </p>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={selected.size === 0 || submitting}
            onClick={() => onAdd(Array.from(selected))}
          >
            {submitting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            Add {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
