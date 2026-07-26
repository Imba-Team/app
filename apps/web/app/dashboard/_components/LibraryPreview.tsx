"use client";

import Link from "next/link";
import { ArrowRight, Folder as FolderIcon, Layers, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Folder, LibraryItem } from "@/lib/api";
import { useFolders, useLibrarySets } from "@/lib/hooks/useLibrary";

const PREVIEW_LIMIT = 6;

type Row =
  | { kind: "folder"; folder: Folder }
  | { kind: "set"; set: LibraryItem };

export function LibraryPreview() {
  const sets = useLibrarySets();
  const folders = useFolders();

  const isLoading = sets.isLoading || folders.isLoading;

  // Merge both into one interleaved list, folders first (they're the
  // organizing structure, so users look for them ahead of loose sets).
  // Cap at PREVIEW_LIMIT — the full library lives one click away.
  const rows: Row[] = [
    ...(folders.data ?? []).map((f) => ({ kind: "folder" as const, folder: f })),
    ...(sets.data ?? []).map((s) => ({ kind: "set" as const, set: s })),
  ].slice(0, PREVIEW_LIMIT);

  const totalFolders = folders.data?.length ?? 0;
  const totalSets = sets.data?.length ?? 0;
  const isEmpty = !isLoading && rows.length === 0;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-[#4255FF]">Your library</h2>
        <Link
          href="/library"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#4255FF]"
        >
          Open library <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-lg bg-gray-100" />
      ) : isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="font-semibold text-gray-800">Your library is empty.</p>
            <p className="text-sm text-gray-500">
              Modules you create or collect from Discover show up here.
            </p>
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link href="/modules/new">
                  <Plus className="mr-1 h-4 w-4" /> New module
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/discover">Browse Discover</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-gray-400">
              <span>{totalFolders} folder{totalFolders === 1 ? "" : "s"}</span>
              <span>·</span>
              <span>{totalSets} module{totalSets === 1 ? "" : "s"}</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {rows.map((r) =>
                r.kind === "folder" ? (
                  <FolderRow key={`f-${r.folder.id}`} folder={r.folder} />
                ) : (
                  <SetRow key={`s-${r.set.id}`} set={r.set} />
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function FolderRow({ folder }: { folder: Folder }) {
  const count = folder.studySets?.length ?? 0;
  return (
    <li>
      <Link
        href={`/library/folders/${folder.id}`}
        className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50"
      >
        <div className="rounded-md bg-[#4255FF]/10 p-1.5 text-[#4255FF]">
          <FolderIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-800">
            {folder.name}
          </p>
          {folder.description && (
            <p className="truncate text-xs text-gray-500">{folder.description}</p>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {count} module{count === 1 ? "" : "s"}
        </span>
      </Link>
    </li>
  );
}

function SetRow({ set }: { set: LibraryItem }) {
  return (
    <li>
      <Link
        href={`/modules/${set.id}`}
        className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50"
      >
        <div className="rounded-md bg-emerald-100 p-1.5 text-emerald-700">
          <Layers className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-800">
            {set.title}
          </p>
          {set.description && (
            <p className="truncate text-xs text-gray-500">{set.description}</p>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-gray-400">
          {set.isOwner ? "Owned" : "Saved"}
        </span>
      </Link>
    </li>
  );
}
