"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Folder as FolderIcon,
  Layers,
  Plus,
  SearchX,
  Star,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Folder, LibraryItem } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useFolders, useLibrarySets } from "@/lib/hooks/useLibrary";

import { NewFolderDialog } from "./_components/NewFolderDialog";

type Filter = "all" | "owned" | "favourited" | "folders";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "owned", label: "Owned" },
  { id: "favourited", label: "Favourited" },
  { id: "folders", label: "Folders" },
];

export default function LibraryPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const sets = useLibrarySets();
  const folders = useFolders();

  const q = debouncedSearch.trim().toLowerCase();

  const filteredSets = useMemo(() => {
    const list = sets.data ?? [];
    return list
      .filter((s) => (filter === "owned" ? s.isOwner : true))
      .filter((s) =>
        filter === "favourited" ? s.isFavourited && !s.isOwner : true,
      )
      .filter((s) =>
        q
          ? s.title.toLowerCase().includes(q) ||
            (s.description ?? "").toLowerCase().includes(q)
          : true,
      );
  }, [sets.data, filter, q]);

  const filteredFolders = useMemo(() => {
    const list = folders.data ?? [];
    return list.filter((f) =>
      q
        ? f.name.toLowerCase().includes(q) ||
          (f.description ?? "").toLowerCase().includes(q)
        : true,
    );
  }, [folders.data, q]);

  const showFolders = filter === "all" || filter === "folders";
  const showSets = filter !== "folders";

  const isLoading = sets.isLoading || folders.isLoading;

  const isEmpty =
    !isLoading &&
    (showSets ? filteredSets.length === 0 : true) &&
    (showFolders ? filteredFolders.length === 0 : true);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-[#4255FF]">Library</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewFolderOpen(true)}
          >
            <FolderIcon className="mr-1 h-4 w-4" /> New folder
          </Button>
          <Button size="sm" asChild>
            <Link href="/modules/new">
              <Plus className="mr-1 h-4 w-4" /> New module
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Input
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
            className={`rounded-full px-3 py-1 text-sm transition ${
              filter === f.id
                ? "bg-[#4255FF] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
        <EmptyState searching={q.length > 0} filter={filter} />
      ) : (
        <div className="space-y-8">
          {showFolders && filteredFolders.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
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
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Modules · {filteredSets.length}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredSets.map((s) => (
                  <SetCard
                    key={s.id}
                    set={s}
                    onClick={() => router.push(`/modules/${s.id}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <NewFolderDialog open={newFolderOpen} onOpenChange={setNewFolderOpen} />
    </main>
  );
}

function FolderCard({
  folder,
  onClick,
}: {
  folder: Folder;
  onClick: () => void;
}) {
  const count = folder.studySets?.length ?? 0;
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer border-none shadow-sm transition hover:shadow-md"
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-md bg-[#4255FF]/10 p-2 text-[#4255FF]">
          <FolderIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">{folder.name}</p>
          {folder.description && (
            <p className="truncate text-sm text-gray-500">
              {folder.description}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {count} module{count === 1 ? "" : "s"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SetCard({
  set,
  onClick,
}: {
  set: LibraryItem;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer border-none shadow-sm transition hover:shadow-md"
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-md bg-emerald-100 p-2 text-emerald-700">
          <Layers className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-gray-900">{set.title}</p>
            {set.visibility === "PRIVATE" && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                Private
              </span>
            )}
          </div>
          {set.description && (
            <p className="truncate text-sm text-gray-500">{set.description}</p>
          )}
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

function EmptyState({ searching, filter }: { searching: boolean; filter: Filter }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
        <SearchX className="h-8 w-8 text-gray-400" />
        <p className="font-semibold text-gray-800">
          {searching
            ? "Nothing matches that search."
            : filter === "folders"
              ? "No folders yet."
              : filter === "favourited"
                ? "You haven't collected anything yet."
                : "Your library is empty."}
        </p>
        <p className="text-sm text-gray-500">
          {filter === "folders"
            ? "Folders group modules together — create one to keep things tidy."
            : "Create a module or browse the community to fill your library."}
        </p>
        <div className="mt-2 flex gap-2">
          <Button asChild size="sm">
            <Link href="/modules/new">New module</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/discover">Browse discover</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
