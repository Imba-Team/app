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
 * Baseline handlers covering the full Sprint 1 auth surface. Feature branches
 * extend via `server.use(...)` in tests or per-feature handler modules.
 *
 * Patterns start with `*` so they match regardless of VITE_API_BASE_URL.
 * The backend uses cookie-based auth, so mutation endpoints return null data.
 */
export const handlers = [
  // Auth
  http.post('*/auth/login', async () => HttpResponse.json(ok(null))),
  http.post('*/auth/register', async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    return HttpResponse.json(ok({ email: body.email ?? 'test@example.com' }), {
      status: 202,
    });
  }),
  http.post('*/auth/logout', async () => HttpResponse.json(ok(null))),
  http.post('*/auth/refresh', async () => HttpResponse.json(ok(null))),
  http.post('*/auth/verify-email', async () => HttpResponse.json(ok(null))),
  http.post('*/auth/resend-verification', async () => HttpResponse.json(ok(null))),
  http.post('*/auth/forgot-password', async () => HttpResponse.json(ok(null))),
  http.post('*/auth/reset-password', async () => HttpResponse.json(ok(null))),

  // User profile
  http.get('*/users/me', async () => HttpResponse.json(ok(FAKE_USER))),
  http.patch('*/users/me', async ({ request }) => {
    const body = (await request.json()) as Partial<User>;
    return HttpResponse.json(ok({ ...FAKE_USER, ...body }));
  }),
  http.patch('*/users/me/profile-picture', async () =>
    HttpResponse.json(ok({ ...FAKE_USER, profilePicture: 'https://cdn.test/avatar.png' })),
  ),
  http.patch('*/users/me/change-password', async () => HttpResponse.json(ok(null))),
  http.delete('*/users/me', async () => HttpResponse.json(ok(FAKE_USER))),
];
