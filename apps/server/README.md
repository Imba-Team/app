# Mimir server (`@mimir/server`)

The Mimir API: auth, study sets and cards, folders and library, study modes (Flashcards, Learn, Write, Test), the SM-2 spaced-repetition engine, progress analytics, comments and search. NestJS 11 on Postgres via Prisma 6, with Redis + BullMQ for background jobs, Elasticsearch for search and MinIO/S3 for uploads.

## Run it

From the repo root:

```bash
pnpm install
docker compose up -d                          # Postgres, Redis, Elasticsearch, MinIO
pnpm --filter @mimir/server prisma:migrate    # apply migrations (loads the root .env)
pnpm dev:server                               # nest start --watch on :9090
```

Configuration comes from the root `.env` in development (process env in production). The main groups:

- **Database:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (direct connection used by migrations).
- **Auth:** `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` (or `*_BASE64` / `*_PATH`; RS256), `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL`, `FRONTEND_BASE_URL`.
- **Redis / queues:** `REDIS_URL` or `REDIS_HOST` + `REDIS_PORT` (+ `REDIS_PASSWORD`).
- **Search:** `ELASTICSEARCH_NODE`.
- **Storage:** `MINIO_*` (endpoint, credentials, bucket, public URL).
- **Mail:** `RESEND_API_KEY`, `SENDGRID_API_KEY` or SMTP `MAIL_*`, plus `MAIL_FROM`.

See [render.yaml](../../render.yaml) for the production set and [docs/auth.md](../../docs/auth.md) for how auth works.

## Scripts

| Script | What it does |
| --- | --- |
| `dev` / `build` / `start` | Watch mode, compile, run `dist/main.js` |
| `prisma:migrate` | `prisma migrate dev` with the root `.env` |
| `prisma:deploy` | `prisma migrate deploy` (production / CI) |
| `generate` | Regenerate the Prisma client |
| `studio` | Prisma Studio |
| `test` | Jest unit tests (`src/**/*.spec.ts`) |
| `lint` / `lint:fix` | ESLint check / apply fixes |
| `openapi` | Regenerate `generated/openapi.json` + `generated/api-types.ts` |
| `openapi:check` | Fail if the generated spec/types are out of date |

## API

- Swagger UI is served at `/api` when the server runs; the generated spec lives in [generated/openapi.json](generated/openapi.json) and feeds the web app's types ([docs/openapi.md](../../docs/openapi.md)).
- Every response is wrapped as `{ ok, message, data, meta? }` by a global interceptor — controllers return the raw payload.
- Auth uses HttpOnly cookies: access token `token`, rotating refresh token `refresh_token`.

## Layout

- `src/modules/<feature>/` — one Nest module per feature (`auth`, `users`, `study-set`, `flashcard`, `folder`, `library`, `learning`, `srs`, `test`, `analytics`, `search`, `comment`, `tag`, …) with `dtos/`, controller and service. `ai`, `classroom` and `notification` are health-check stubs for now.
- `src/common/` — shared infrastructure: Prisma, Redis, BullMQ queues, storage, mail, logging, metrics, text hygiene, time helpers.
- `prisma/` — `schema.prisma` and the migration history. CI (`.github/workflows/migrations.yml`) builds an empty database from the migrations and checks it matches the schema.
- `scripts/` — OpenAPI generation.
