import axios, { AxiosError } from 'axios';
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

export class AuthApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    opts: { status?: number; code?: string; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = 'AuthApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

function toAuthError(err: unknown, fallbackMessage: string): AuthApiError {
  if (err instanceof AuthApiError) return err;
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<{
      message?: string;
      code?: string;
      retryAfterSeconds?: number;
    }>;
    const body = axiosErr.response?.data;
    return new AuthApiError(body?.message || axiosErr.message || fallbackMessage, {
      status: axiosErr.response?.status,
      code: body?.code,
      retryAfterSeconds: body?.retryAfterSeconds,
    });
  }
  if (err instanceof Error) {
    return new AuthApiError(err.message || fallbackMessage);
  }
  return new AuthApiError(fallbackMessage);
}

export async function loginUser(credentials: { email: string; password: string }) {
  try {
    const { data } = await apiClient.post<AuthResponse<AuthUser>>('/auth/login', credentials);
    if (!data.ok) throw new AuthApiError(data.message || 'Login failed');
    return data;
  } catch (err) {
    throw toAuthError(err, 'Login failed');
  }
}

export async function registerUser(credentials: {
  username: string;
  email: string;
  password: string;
}) {
  try {
    const { data } = await apiClient.post<AuthResponse<AuthUser>>('/auth/register', credentials);
    if (!data.ok) throw new AuthApiError(data.message || 'Registration failed');
    return data;
  } catch (err) {
    throw toAuthError(err, 'Registration failed');
  }
}

export async function logoutUser() {
  try {
    const { data } = await apiClient.post<AuthResponse<null>>('/auth/logout');
    if (!data.ok) throw new AuthApiError(data.message || 'Logout failed');
    return data;
  } catch (err) {
    throw toAuthError(err, 'Logout failed');
  }
}

export async function getAuthMe() {
  const { data } = await apiClient.get<AuthResponse<AuthUser>>('/users/me');

  if (!data.ok) throw new Error(data.message || 'Failed to fetch auth user');
  return data.data;
}
