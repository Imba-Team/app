import { useMemo, useState, type ReactNode } from 'react';
import axios from 'axios';

import { createApiClient, createMemoryTokenStore } from '@/lib/api';
import { AuthProvider as AuthContextProvider } from '@/lib/api/hooks/auth-context';
import type { components } from '@/lib/api/generated/api-types';

type User = components['schemas']['User'];
type AuthResponse = components['schemas']['AuthResponse'];

// Falls back to the Vite dev-server proxy path so login works with just `pnpm dev`.
// Override via VITE_API_BASE_URL in .env for staging/prod (see .env.example).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/** Unwraps the backend's { ok, message, data } envelope when present. */
function unwrapEnvelope(body: unknown): unknown {
  if (
    body !== null &&
    typeof body === 'object' &&
    'ok' in body &&
    'data' in body &&
    typeof (body as { ok: unknown }).ok === 'boolean'
  ) {
    return (body as { data: unknown }).data;
  }
  return body;
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const { client, tokens } = useMemo(() => {
    const tokens = createMemoryTokenStore();

    const client = createApiClient({
      baseURL: API_BASE_URL,
      tokens,
      refresh: async () => {
        // The refresh token lives in an HttpOnly cookie set by the backend.
        // withCredentials sends it. Response body may be:
        //   - { accessToken, user }               → return the token, hydrate the user
        //   - null (cookie-only session)          → return sentinel; caller keeps using cookies
        try {
          const { data } = await axios.post<unknown>(
            `${API_BASE_URL}/auth/refresh`,
            {},
            { withCredentials: true },
          );
          const payload = unwrapEnvelope(data) as Partial<AuthResponse> | null;

          if (payload && typeof payload.accessToken === 'string' && payload.user) {
            setCurrentUser(payload.user);
            return payload.accessToken;
          }

          // Cookie-only session: cookies were rotated server-side. Empty string signals
          // the client interceptor to retry the original request without setting a Bearer
          // header (see client.ts — null means failure, '' means "cookie handles it").
          return '';
        } catch {
          return null;
        }
      },
      onAuthFailure: () => {
        setCurrentUser(null);
      },
    });

    return { client, tokens };
  }, []);

  return (
    <AuthContextProvider
      client={client}
      tokens={tokens}
      currentUser={currentUser}
      setCurrentUser={setCurrentUser}
    >
      {children}
    </AuthContextProvider>
  );
}
