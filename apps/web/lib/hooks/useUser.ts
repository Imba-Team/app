"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
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
 * by design, and multipart requires the browser to set the Content-Type
 * (including the boundary parameter) itself.
 *
 * Gotcha: axios 1.x's `transformRequest` inspects the Content-Type
 * header, and if it finds "application/json" it will `JSON.stringify`
 * the FormData into a JSON body — see
 * `node_modules/.../axios/lib/defaults/index.js`:
 *     if (isFormData) {
 *       return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
 *     }
 * Our `apiClient` sets `Content-Type: application/json` on the
 * instance, so the default *would* apply here and multer on the server
 * would receive JSON where it expects multipart → 500.
 *
 * Fix: build an `AxiosHeaders` object and call `setContentType(false)`.
 * Axios's `toJSON()` drops any header whose value is `null` / `false`,
 * so the request goes out with NO Content-Type — the browser then
 * fills in `multipart/form-data; boundary=<...>` automatically.
 *
 * The refresh-on-401 interceptor still runs since we're on the same
 * apiClient instance.
 */
export function useUpdateProfilePicture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const headers = new AxiosHeaders();
      headers.setContentType(false);
      const { data } = await apiClient.patch<{
        ok: boolean;
        message?: string;
        data?: User;
      }>("/users/me/profile-picture", formData, { headers });
      return unwrap(data, "Failed to upload profile picture");
    },
    onMutate: async (file: File) => {
      // Optimistic UX: show the picked file immediately as a preview.
      // The blob URL is scoped to this browser tab, so it's cheap; we
      // revoke it in onSettled to avoid leaking memory when the real
      // server URL replaces it.
      const previewUrl = URL.createObjectURL(file);
      await qc.cancelQueries({ queryKey: userKeys.me() });
      const previous = qc.getQueryData<User>(userKeys.me());
      if (previous) {
        qc.setQueryData<User>(userKeys.me(), {
          ...previous,
          profilePicture: previewUrl,
        });
      }
      return { previous, previewUrl };
    },
    onSuccess: (user) => {
      // Trust the server response — it's the canonical URL. We still
      // invalidate to keep any other queries that read `/users/me` in sync.
      qc.setQueryData(userKeys.me(), user);
      qc.invalidateQueries({ queryKey: userKeys.me() });
      toast.success("Profile picture updated");
    },
    onError: (err: unknown, _file, ctx) => {
      // Roll the cache back to what the server actually said.
      if (ctx?.previous) qc.setQueryData(userKeys.me(), ctx.previous);
      const serverError = extractServerError(err);
      toast.error(serverError ?? "Failed to upload profile picture");
    },
    onSettled: (_data, _err, _file, ctx) => {
      // Release the blob URL now that the real (or rolled-back) value
      // is in the cache.
      if (ctx?.previewUrl) URL.revokeObjectURL(ctx.previewUrl);
    },
  });
}

/**
 * Best-effort extraction of the server's `message` field from an axios
 * error payload. Falls back to the generic Error.message when the
 * response envelope doesn't match the expected shape.
 */
function extractServerError(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const response = (err as { response?: { data?: unknown } }).response;
  const data = response?.data;
  if (data && typeof data === "object") {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  const msg = (err as { message?: unknown }).message;
  return typeof msg === "string" ? msg : undefined;
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
