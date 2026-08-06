import { apiClient } from '@/lib/axios';
import type { AuthResponse } from '@/lib/api/auth';

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const { data } = await apiClient.get<AuthResponse<SessionSummary[]>>('/auth/sessions');
  if (!data.ok) throw new Error(data.message || 'Failed to load sessions');
  return data.data;
}

export interface RevokeSessionResult {
  wasCurrent: boolean;
}

export async function revokeSession(id: string): Promise<RevokeSessionResult> {
  const { data } = await apiClient.delete<AuthResponse<RevokeSessionResult>>(
    `/auth/sessions/${encodeURIComponent(id)}`,
  );
  if (!data.ok) throw new Error(data.message || 'Failed to revoke session');
  return data.data;
}
