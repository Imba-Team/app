# GitHub Actions CI

What each workflow checks, how to reproduce a failure locally, and how to add a check.

All workflows use pnpm from the root `packageManager` field and Node from [`.nvmrc`](../.nvmrc). Each has a `concurrency` group with `cancel-in-progress: true`, so a new push cancels the previous run for the same ref.

## Workflows at a glance

| Workflow | File | Triggers | What it gates |
|---|---|---|---|
| **server-ci** | [`server-ci.yml`](../.github/workflows/server-ci.yml) | push to `main`/`dev`, every PR | server lint, unit tests, build, OpenAPI drift |
| **web-ci** | [`web-ci.yml`](../.github/workflows/web-ci.yml) | push to `main`/`dev`, every PR | web lint, type-check, production build |
| **migrations** | [`migrations.yml`](../.github/workflows/migrations.yml) | changes under `apps/server/prisma/` | the migration history builds an empty DB that matches `schema.prisma` |
| **docker-build** | [`docker.yml`](../.github/workflows/docker.yml) | push/PR to `main` | per-service Docker images (legacy — production deploys natively on Render, see below) |

## server-ci

| Step | Command | Protects against |
|---|---|---|
| Prisma client | `pnpm --filter @mimir/server exec prisma generate` | code compiled against a stale client |
| Lint | `pnpm --filter @mimir/server lint` | lint **errors** (warnings don't fail; `lint` never auto-fixes — use `lint:fix` locally) |
| Unit tests | `pnpm --filter @mimir/server exec jest` | behaviour regressions |
| Build | `pnpm --filter @mimir/server build` | type errors, Nest compile errors |
| OpenAPI | `pnpm --filter @mimir/server openapi:check` | controllers/DTOs changed without regenerating `generated/` |
| Web types | `diff apps/server/generated/api-types.ts apps/web/lib/api/generated.ts` | the web app using stale API types |

`openapi:check` boots `AppModule` to build the spec. It needs config values (a `DATABASE_URL` and MinIO credentials, set as dummy values in the workflow) but no running services — nothing connects until a request or job runs.

Fix an OpenAPI failure with `pnpm --filter @mimir/server openapi && pnpm --filter @mimir/web generate:api-types` and commit the regenerated files.

## web-ci

`pnpm --filter @mimir/web lint`, `type-check` (`tsc --noEmit`) and `build` (`next build`). There is no web unit-test runner yet, and the web app isn't prettier-clean yet, so there is no format check.

## migrations

Starts a Postgres 16 service container, then:

1. `prisma migrate deploy` on the empty database — every migration must apply from scratch.
2. `prisma migrate diff --from-url … --to-schema-datamodel … --exit-code` — the resulting database must equal `schema.prisma`.
3. The same diff from the migration history (via a shadow database) — catches a schema edit without a migration.

Never edit an applied migration; add a new one generated with `prisma migrate diff`.

## docker-build

Builds the root [`Dockerfile`](../Dockerfile) once per logical service name (`SERVICE_NAME` build-arg labels metrics and logs) and checks the image exists. It predates the Render deployment, which builds natively from [`render.yaml`](../render.yaml) — whether to keep it is an open question in Linear.

## Reproducing a failure locally

Run the failing step's command from the repo root with the same Node major version as `.nvmrc`. For example:

```bash
pnpm install --frozen-lockfile
pnpm --filter @mimir/server lint
pnpm --filter @mimir/server exec jest
pnpm --filter @mimir/server openapi:check
pnpm --filter @mimir/web type-check
pnpm --filter @mimir/web build
```

For `migrations`, point `DATABASE_URL` and `DATABASE_URL_UNPOOLED` at an empty throwaway Postgres (not your dev DB) and run the three commands from the workflow in `apps/server`.

## Adding a check

- Call a package script through `pnpm --filter <pkg> <script>` so the same command works locally.
- Put cheap checks (lint) before slow ones (build).
- Don't use `continue-on-error` to hide a real failure — fix it or open an issue.

## Branch protection (recommended)

On `main` (and `dev` if you merge through PRs): require `server-ci`, `web-ci` and, when present on the PR, `migrations` to pass; require branches to be up to date; block force-pushes and deletions.
