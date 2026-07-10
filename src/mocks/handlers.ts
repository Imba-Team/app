import { http, HttpResponse } from 'msw';

import type { components } from '@/lib/api/generated/api-types';

type User = components['schemas']['User'];
type AuthResponse = components['schemas']['AuthResponse'];

/**
 * Mirror the backend's success envelope so the axios interceptor
 * ({ ok, data } → data) unwraps mocked responses identically to real ones.
 */
function ok<T>(data: T) {
  return { ok: true, data };
}

const FAKE_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'jane@mimir.test',
  username: 'jane',
  displayName: 'Jane Doe',
  avatarUrl: null,
  role: 'REGISTERED',
  preferredLanguage: 'en',
  emailVerified: true,
};

const FAKE_AUTH: AuthResponse = {
  accessToken: 'test-access-token',
  user: FAKE_USER,
};

/**
 * Baseline handlers. Feature branches should extend this list (via
 * `server.use(...)` in tests, or by exporting per-feature handler modules).
 *
 * Patterns start with `*` so they match regardless of `VITE_API_BASE_URL`.
 */
export const handlers = [
  http.post('*/auth/login', async () => HttpResponse.json(ok(FAKE_AUTH))),
  http.post('*/auth/register', async () => HttpResponse.json(ok(FAKE_AUTH))),
  http.post('*/auth/logout', async () => new HttpResponse(null, { status: 204 })),
  http.post('*/auth/refresh', async () =>
    HttpResponse.json(ok({ accessToken: 'refreshed-token' })),
  ),
  http.get('*/auth/me', async () => HttpResponse.json(ok(FAKE_USER))),
  http.get('*/users/me', async () => HttpResponse.json(ok(FAKE_USER))),
];
