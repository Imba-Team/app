import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getAuthMe, loginUser, logoutUser, registerUser, type AuthUser } from '@/lib/api/auth';

const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => loginUser(credentials),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Login failed');
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (credentials: { name: string; email: string; password: string }) =>
      registerUser(credentials),
    onError: (error: Error) => {
      toast.error(error.message || 'Registration failed');
    },
  });
}

export function useAuthMe() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: getAuthMe,
    retry: false,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutUser,
    onSuccess: async () => {
      await queryClient.clear();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Logout failed');
    },
  });
}
