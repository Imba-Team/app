/**
 * AUTO-GENERATED placeholder — do NOT edit manually.
 *
 * Once the backend is running, this file is overwritten by
 * `pnpm generate:api-types` (see scripts/generate-api-types.sh).
 *
 * Until then, we keep a minimal hand-rolled subset for use by hooks and screens
 * so the frontend can compile without the backend being up. Every hand-rolled type
 * here is temporary — delete when the generator overwrites this file.
 */

export interface paths {
  '/v1/auth/register': { post: unknown };
  '/v1/auth/login': { post: unknown };
  '/v1/auth/refresh': { post: unknown };
  '/v1/auth/logout': { post: unknown };
  '/v1/auth/me': { get: unknown };
}

export interface components {
  schemas: {
    User: {
      id: string;
      email: string;
      username: string;
      displayName: string;
      avatarUrl?: string | null;
      role: 'REGISTERED' | 'TEACHER' | 'ADMIN';
      preferredLanguage: string;
      emailVerified: boolean;
    };
    AuthResponse: {
      accessToken: string;
      user: components['schemas']['User'];
    };
  };
}
