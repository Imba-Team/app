import { apiClient } from '@/lib/axios';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  status?: string;
  role?: string;
}

export interface AuthResponse<T = unknown> {
  ok: boolean;
  message?: string;
  data: T;
}

export async function loginUser(credentials: { email: string; password: string }) {
  const { data } = await apiClient.post<AuthResponse<AuthUser>>('/auth/login', credentials);

  if (!data.ok) throw new Error(data.message || 'Login failed');
  return data;
}

export async function registerUser(credentials: {
  username: string;
  email: string;
  password: string;
}) {
  const { data } = await apiClient.post<AuthResponse<AuthUser>>('/auth/register', credentials);

  if (!data.ok) throw new Error(data.message || 'Registration failed');
  return data;
}

export async function logoutUser() {
  const { data } = await apiClient.post<AuthResponse<null>>('/auth/logout');

  if (!data.ok) throw new Error(data.message || 'Logout failed');
  return data;
}

export async function getAuthMe() {
  const { data } = await apiClient.get<AuthResponse<AuthUser>>('/users/me');

  if (!data.ok) throw new Error(data.message || 'Failed to fetch auth user');
  return data.data;
}
