import { http, HttpResponse } from 'msw';

import type { components } from '@/lib/api/generated/api-types';

type User = components['schemas']['UserResponseDto'];

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
  name: 'jane',
  bio: null,
  emailVerified: true,
  role: 'user',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  profilePicture: null,
};

/**
 * Baseline handlers. Feature branches should extend this list (via
 * `server.use(...)` in tests, or by exporting per-feature handler modules).
 *
 * Patterns start with `*` so they match regardless of `VITE_API_BASE_URL`.
 * The backend uses cookie-based auth, so login/register/refresh return null data.
 */
export const handlers = [
  http.post('*/auth/login', async () => HttpResponse.json(ok(null))),
  http.post('*/auth/register', async () => HttpResponse.json(ok(null))),
  http.post('*/auth/logout', async () => HttpResponse.json(ok(null))),
  http.post('*/auth/refresh', async () => HttpResponse.json(ok(null))),
  http.get('*/users/me', async () => HttpResponse.json(ok(FAKE_USER))),
];
