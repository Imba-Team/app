"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/axios";
import { apiFetch, type Schemas } from "@/lib/api/client";
import { toast } from "sonner";

/**
 * The account owner's own user record. Sourced directly from the server
 * DTO so any field added on the backend surfaces here without touching
 * the hook. Read-only aliases the raw generated schema.
 */
export type User = Schemas["UserResponseDto"];
export type UpdateMyProfilePayload = Schemas["UpdateMyProfileDto"];
export type ChangePasswordPayload = Schemas["ChangePasswordDto"];

const userKeys = {
  all: ["user"] as const,
  me: () => [...userKeys.all, "me"] as const,
};

function unwrap<T>(res: { ok: boolean; message?: string; data?: T } | undefined, fallback: string): T {
  if (!res?.ok || res.data === undefined) {
    throw new Error(res?.message || fallback);
  }
  return res.data;
}

export function useMe() {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: async () => {
      const res = await apiFetch("get", "/users/me");
      return unwrap(res, "Failed to load profile");
    },
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateMyProfilePayload) => {
      const res = await apiFetch("patch", "/users/me", { body: payload });
      return unwrap(res, "Failed to update profile");
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: userKeys.me() });
      const previous = qc.getQueryData<User>(userKeys.me());
      if (previous) {
        qc.setQueryData<User>(userKeys.me(), { ...previous, ...payload });
      }
      return { previous };
    },
    onError: (err: unknown, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(userKeys.me(), ctx.previous);
      toast.error((err as Error).message || "Failed to update profile");
    },
    onSuccess: (user) => {
      qc.setQueryData(userKeys.me(), user);
      toast.success("Profile updated");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

export function useDeleteMe() {
  return useMutation({
    mutationFn: async () => {
      await apiFetch("delete", "/users/me");
    },
    onSuccess: () => {
      toast.success("Account deleted");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message || "Failed to delete account");
    },
  });
}

/**
 * File uploads go through the raw axios client — apiFetch is JSON-only
 * by design, and multipart requires a different Content-Type. The
 * refresh-on-401 interceptor still runs since we're on the same
 * apiClient instance.
 */
export function useUpdateProfilePicture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.patch<{
        ok: boolean;
        message?: string;
        data?: User;
      }>("/users/me/profile-picture", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return unwrap(data, "Failed to upload profile picture");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.me() });
      toast.success("Profile picture updated");
    },
    onError: (err: unknown) => {
      toast.error(
        (err as Error).message || "Failed to upload profile picture",
      );
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: ChangePasswordPayload) => {
      const res = await apiFetch("patch", "/users/me/change-password", {
        body: payload,
      });
      // 200 with { data: null } — nothing to unwrap, but propagate errors.
      if (!res?.ok) {
        throw new Error(res?.message || "Failed to change password");
      }
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message || "Failed to change password");
    },
  });
}
