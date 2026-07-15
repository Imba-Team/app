import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/axios";
import { toast } from "sonner";

export function useLogin() {
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const { data } = await apiClient.post("/auth/login", credentials);
      if (!data.ok) throw new Error(data.message || "Login failed");
      return data;
    },
    onError: (error: Error) => {
      toast.error(error.message || "Login failed");
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (credentials: {
      name: string;
      email: string;
      password: string;
    }) => {
      const { data } = await apiClient.post("/auth/register", credentials);
      if (!data.ok) throw new Error(data.message || "Registration failed");
      return data;
    },
    onError: (error: Error) => {
      toast.error(error.message || "Registration failed");
    },
  });
}
