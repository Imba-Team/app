import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { components } from '../generated/api-types';
import { useAuth } from './auth-context';

type User = components['schemas']['UserResponseDto'];

export interface UpdateMyProfilePayload {
  name?: string;
  bio?: string;
}

export function useUpdateMyProfile() {
  const { client, setCurrentUser } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateMyProfilePayload): Promise<User> => {
      const { data } = await client.patch<User>('/users/me', payload);
      return data;
    },
    onSuccess: (user) => {
      setCurrentUser(user);
      qc.setQueryData(['auth', 'me'], user);
    },
  });
}

export function useUpdateAvatar() {
  const { client, setCurrentUser } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<User> => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await client.patch<User>('/users/me/profile-picture', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (user) => {
      setCurrentUser(user);
      qc.setQueryData(['auth', 'me'], user);
    },
  });
}

export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function useChangePassword() {
  const { client } = useAuth();

  return useMutation({
    mutationFn: async (payload: ChangePasswordPayload): Promise<void> => {
      await client.patch('/users/me/change-password', payload);
    },
  });
}

export function useDeleteMyAccount() {
  const { client, tokens, setCurrentUser } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      await client.delete('/users/me');
    },
    onSuccess: () => {
      tokens.setAccessToken(null);
      setCurrentUser(null);
      qc.clear();
    },
  });
}
