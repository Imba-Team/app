import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/axios";
import { toast } from "sonner";

export type User = {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  status?: string;
  role?: string;
};

const userKeys = {
  all: ["user"] as const,
  me: () => [...userKeys.all, "me"] as const,
};

export function useMe() {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: async () => {
      const { data } = await apiClient.get("/users/me");
      return data.data as User;
    },
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<User>) => {
      const { data } = await apiClient.patch("/users/me", payload);
      return data.data as User;
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: userKeys.me() });
      const previous = qc.getQueryData<User>(userKeys.me());
      if (previous) {
        qc.setQueryData(userKeys.me(), { ...previous, ...payload });
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
      const { data } = await apiClient.delete("/users/me");
      return data;
    },
    onSuccess: () => {
      toast.success("Account deleted");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message || "Failed to delete account");
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: {
      oldPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      const { data } = await apiClient.patch(
        "/users/me/change-password",
        payload
      );
      return data;
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message || "Failed to change password");
    },
  });
}
