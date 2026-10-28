# Mimir

Monorepo for the Mimir language-learning platform.

## Layout

```
apps/
  server/    NestJS backend — API, SRS engine, auth, learning services (@mimir/server)
  web/       Next.js 16 (App Router) + React 19 frontend (@mimir/web)
docs/        Project-wide documentation
monitoring/  Prometheus + Grafana stack for local observability
.github/     CI workflows (server-ci.yml, web-ci.yml, migrations.yml, docker.yml)
docker-compose.yml              Postgres + Redis + ancillary services for local dev
docker-compose.monitoring.yml   Optional monitoring stack
```

## Prerequisites

- Node.js 22 (see `.nvmrc`; >= 20.10 works)
- pnpm >= 9 (pinned to 10.33.0 via `packageManager`)
- Docker (for Postgres, Redis)

## Getting started

```bash
pnpm install                       # installs both apps at the workspace root
docker compose up -d               # start postgres, redis, etc.
pnpm --filter @mimir/server prisma:migrate   # loads the root .env
pnpm dev                           # runs server + web in parallel
```

Run one app at a time:

```bash
pnpm dev:server                    # nest start --watch
pnpm dev:web                       # next dev on :3000
```

Per-app details live in [apps/server/README.md](apps/server/README.md) and [apps/web/README.md](apps/web/README.md).

## Scripts (workspace root)

| Script            | What it does                                                        |
| ----------------- | ------------------------------------------------------------------- |
| `pnpm dev`        | Runs `dev` in every workspace in parallel, streaming output.        |
| `pnpm build`      | Runs `build` in every workspace.                                    |
| `pnpm test`       | Runs `test` in every workspace.                                     |
| `pnpm lint`       | Runs `lint` in every workspace.                                     |
| `pnpm format`     | Prettier writes across the whole repo (honours `.gitignore`).       |
| `pnpm clean`      | Removes each workspace's build artifacts + root `node_modules`.     |

Target one workspace with `pnpm --filter @mimir/server <script>` or `--filter @mimir/web`.

## History

The backend history is preserved via `git mv` (use `git log --follow <file>` to trace).
The frontend was imported via `git subtree add` from the `frontend-v2` repo, so all
its historical commits are visible under `apps/web/` and reachable by normal `git log`.
