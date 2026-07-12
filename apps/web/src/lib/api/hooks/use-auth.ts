import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { components } from '../generated/api-types.js';
import { useAuth } from './auth-context.js';

type User = components['schemas']['UserResponseDto'];

// Backend is cookie-only (returns { ok, data: null }); some deployments may return
// { accessToken, user } in the body, so the auth flow accepts either shape.
interface AuthResponse {
  accessToken?: string;
  user?: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  username: string;
}

/**
 * Some backends return the user + token in the login response body:
 *   { accessToken, user }
 * Others (like ours) authenticate via HttpOnly cookies and return a null payload,
 * requiring a follow-up GET /auth/me. This helper picks whichever shape landed.
 */
async function extractAuthResult(
  client: ReturnType<typeof useAuth>['client'],
  loginBody: unknown,
): Promise<{ accessToken: string; user: User }> {
  const body = loginBody as Partial<AuthResponse> | null | undefined;

  // Case A: backend returned everything in the body
  if (body && typeof body.accessToken === 'string' && body.user) {
    return { accessToken: body.accessToken, user: body.user };
  }

  // Case B: cookie-based session — fetch the user from /users/me.
  // The envelope interceptor already unwrapped the body, so `data` here is the User.
  const { data: me } = await client.get<User | null>('/users/me');
  if (!me || typeof me !== 'object') {
    throw new Error(
      'Login succeeded but GET /users/me did not return a user. ' +
        'Verify the /users/me endpoint exists and returns the current user.',
    );
  }
  // Access token lives in an HttpOnly cookie now — no Bearer token to store.
  return { accessToken: '', user: me };
}

export function useLogin() {
  const { client, tokens, setCurrentUser } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LoginPayload): Promise<{ accessToken: string; user: User }> => {
      const { data } = await client.post<AuthResponse | null>('/auth/login', payload);
      if (import.meta.env.DEV) {
        console.debug('[auth/login] response body (post-unwrap):', data);
      }
      return extractAuthResult(client, data);
    },
    onSuccess: ({ accessToken, user }) => {
      tokens.setAccessToken(accessToken || null);
      setCurrentUser(user);
      qc.setQueryData(['auth', 'me'], user);
    },
  });
}

/**
 * Register does NOT log the user in — the backend creates an unverified user and
 * sends a verification email. The user completes registration by clicking the
 * link, then logs in normally. See /auth/verify-email page.
 */
export function useRegister() {
  const { client } = useAuth();

  return useMutation({
    mutationFn: async (payload: RegisterPayload): Promise<{ email: string }> => {
      const { data } = await client.post<{ email: string } | null>('/auth/register', payload);
      return { email: data?.email ?? payload.email };
    },
  });
}

export function useLogout() {
  const { client, tokens, setCurrentUser } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await client.post('/auth/logout').catch(() => undefined);
    },
    onSettled: () => {
      tokens.setAccessToken(null);
      setCurrentUser(null);
      qc.clear();
    },
  });
}

export function useCurrentUser() {
  const { client, currentUser } = useAuth();
  return useQuery({
    queryKey: ['auth', 'me'] as const,
    queryFn: async (): Promise<User> => {
      const { data } = await client.get<User>('/users/me');
      return data;
    },
    initialData: currentUser ?? undefined,
    staleTime: 5 * 60 * 1000,
    enabled: currentUser !== null,
  });
}
