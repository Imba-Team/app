import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  addSetsToFolder,
  createFolder,
  deleteFolder,
  getFolderById,
  getFolders,
  getLibrary,
  removeSetFromFolder,
  updateFolder,
  type CreateFolderData,
  type UpdateFolderData,
} from "@/lib/api";

export const libraryKeys = {
  all: ["library"] as const,
  sets: () => [...libraryKeys.all, "sets"] as const,
  folders: () => [...libraryKeys.all, "folders"] as const,
  folder: (id: string) => [...libraryKeys.folders(), id] as const,
};

export function useLibrarySets() {
  return useQuery({
    queryKey: libraryKeys.sets(),
    queryFn: getLibrary,
  });
}

export function useFolders() {
  return useQuery({
    queryKey: libraryKeys.folders(),
    queryFn: getFolders,
  });
}

export function useFolder(id: string) {
  return useQuery({
    queryKey: libraryKeys.folder(id),
    queryFn: () => getFolderById(id),
    enabled: !!id,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFolderData) => createFolder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryKeys.folders() });
      toast.success("Folder created");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create folder"),
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFolderData }) =>
      updateFolder(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: libraryKeys.folders() });
      qc.invalidateQueries({ queryKey: libraryKeys.folder(vars.id) });
      toast.success("Folder updated");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update folder"),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryKeys.folders() });
      toast.success("Folder deleted");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete folder"),
  });
}

export function useAddSetsToFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      folderId,
      studySetIds,
    }: {
      folderId: string;
      studySetIds: string[];
    }) => addSetsToFolder(folderId, studySetIds),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: libraryKeys.folder(vars.folderId) });
      qc.invalidateQueries({ queryKey: libraryKeys.folders() });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add to folder"),
  });
}

export function useRemoveSetFromFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      folderId,
      studySetId,
    }: {
      folderId: string;
      studySetId: string;
    }) => removeSetFromFolder(folderId, studySetId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: libraryKeys.folder(vars.folderId) });
      qc.invalidateQueries({ queryKey: libraryKeys.folders() });
    },
    onError: (err: Error) =>
      toast.error(err.message || "Failed to remove from folder"),
  });
}
