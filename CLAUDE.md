# Mimir

Monorepo: [apps/server](apps/server) (NestJS backend, `@mimir/server`) + [apps/web](apps/web) (Next.js app, `@mimir/web`).

## Commands

- `pnpm dev` — server + web in parallel (server on :9090, web on :3000; :9000 is MinIO)
- `pnpm --filter @mimir/server prisma:migrate` — apply migrations (wraps `prisma migrate dev`, loads root `.env`)
- `pnpm --filter @mimir/server generate` — regenerate Prisma client (needed after fresh install; loads root `.env`)
- `pnpm --filter @mimir/server openapi` — regenerate OpenAPI spec + types
- `pnpm --filter @mimir/web generate:api-types` — sync spec into web (calls the server script)
- `pnpm --filter @mimir/web test` — vitest
- `pnpm --filter @mimir/web test:e2e` — Playwright. **Kill any :3000 dev server first** (or use `pnpm test:e2e:ui`).

## Conventions

- **Backend response shape**: `{ ok, message, data }`. The axios client unwraps it automatically — hooks see just `data`.
- **Backend validation**: `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` — never send fields the DTO doesn't declare, or the request 400s.
- **Backend DTOs and ApiProperty**: always give explicit `type: String` on nullable/union fields; without it `openapi-typescript` emits `Record<string, never>` on the web side.
- **Web auth**: access token lives in memory only; refresh token via HttpOnly cookie. [apps/web/src/lib/api/token-store.test.ts](apps/web/src/lib/api/token-store.test.ts) is the regression guard.
- **Web i18n**: every user-facing string reads through `useTranslation('...')`. Locales: `en` (canonical) + `ru` + `az` fully populated; `es`/`de`/`fr` are stubs and fall back to `en`.
- **Web OAuth**: browser must hit the real backend origin (VITE_BACKEND_ORIGIN, defaults to `http://localhost:9090`) so it can follow the redirect chain to Google and back.
- **Playwright**: mock APIs with `page.route(/regex/, ...)` — no MSW browser worker. Match by path only (works whether VITE_API_BASE_URL is the proxy `/api` or the direct backend URL).

## Gotchas

- **Native macOS Postgres** intercepts `localhost:5432` — the mimir docker container gets shadowed. See [memory/env_postgres_conflict.md](.). Use a different port or stop native PG before `prisma db push`.
- **JWT type imports**: `@types/jsonwebtoken@9.0.10+` requires `StringValue` from `ms` for `signOptions.expiresIn`. Only `@types/ms@2.1.0+` provides it (through the `ms` namespace).
- **Backend register endpoint** does not accept `displayName` — only `email`, `username`, `password`. The user's display name is derived from `username` and can be updated via `PATCH /users/me` later.
- **useMutation + useEffect**: don't put the mutation *object* in the deps array — it changes on every state transition. Destructure `mutate` (stable) and depend on that, or you'll race with React's dev-mode double-invoke.

## Layout

- [apps/server](apps/server) — NestJS. Modules under `src/modules/{auth,users,study-sets,srs,...}`.
- [apps/web](apps/web) — Vite + React 18. Routes in `src/routes/`, feature UI in `src/features/`, shared UI kit in `src/components/ui/` (shadcn/Radix), API layer in `src/lib/api/`, i18n in `src/lib/i18n/`.
- [docs/](docs/) — project-wide TDD, roadmap, requirements. `Mimir_TDD_v1.md` in `docs/` is the canonical architecture doc (the copy under `apps/web/` will drift).
- [monitoring/](monitoring/) — Prometheus + Grafana stack (opt-in via `docker-compose.monitoring.yml`).

## Deferred — Sprint 1b (auth completion, needs backend work first)

- **Apple OAuth** — backend `AppleStrategy` in `apps/server/src/modules/auth/` missing; frontend button + `/auth/callback/apple` route already wired.
- **Account lockout UI** — `LoginAttemptsService` exists server-side, but no endpoint surfaces the lock state. Needs either `retryAfter` on 429 login responses or a `GET /auth/lockout-status?email=...` endpoint.
- **Multi-device sessions list + revoke** — no `Session` model. Needs Prisma table, `GET /auth/sessions`, `DELETE /auth/sessions/:id`.
- **Timezone + preferredLanguage on profile** — Prisma User model + `UpdateMyProfileDto` need the columns; then wire into `apps/web/src/features/settings/profile-section.tsx`.
- **Data export** — needs `POST /users/me/export` + `GET /users/me/export/:jobId`, BullMQ job, upload to storage, download URL.

## Current sprint

- **Frontend**: Sprint 2 — Library (Sets + Folders CRUD).
- **Backend**: Sprint 7 (SRS engine landed).
