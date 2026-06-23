# GitHub Actions CI

This document describes the continuous integration pipelines for `mimir-server`, what each job does, and how to debug failures.

> Audience: anyone whose PR is being checked, or anyone tuning the pipeline.

---

## 1. Workflows at a glance

Two workflows live in [`.github/workflows/`](../.github/workflows/):

| Workflow | File | Triggers | What it gates |
|---|---|---|---|
| **ci** | [`ci.yml`](../.github/workflows/ci.yml) | push to `main`, all PRs against `main` | code quality + contract integrity |
| **docker-build** | [`docker.yml`](../.github/workflows/docker.yml) | push to `main`, all PRs against `main` | image builds for every logical service |

Both workflows use the `concurrency` group `${ workflow-name }-${ ref }` with `cancel-in-progress: true`, so pushing a new commit to a PR cancels the previous run.

---

## 2. `ci` workflow

### 2.1 Steps

```yaml
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - Checkout                          # actions/checkout@v4
      - Setup pnpm                        # pnpm/action-setup@v4   (v9)
      - Setup Node.js                     # actions/setup-node@v4  (v20, pnpm cache)
      - Install dependencies              # pnpm install --frozen-lockfile
      - Generate Prisma client            # pnpm prisma generate
      - Lint                              # pnpm run lint
      - Unit tests                        # pnpm exec jest --passWithNoTests
      - Build                             # pnpm run build
      - Verify OpenAPI artifacts          # pnpm run openapi:check
```

### 2.2 What each step protects

| Step | Failure means |
|---|---|
| `pnpm install --frozen-lockfile` | `pnpm-lock.yaml` is out of sync with `package.json`. Run `pnpm install` locally and commit. |
| `pnpm prisma generate` | Prisma schema is invalid. Run `pnpm push` or `pnpm prisma generate` locally. |
| `pnpm run lint` | ESLint errors (warnings don't fail). Run `pnpm run lint` locally — it auto-fixes most. |
| `pnpm exec jest --passWithNoTests` | A unit test failed. (Suite is currently empty — `--passWithNoTests` keeps CI green until tests are added.) |
| `pnpm run build` | TypeScript compile error or NestJS metadata problem. |
| `pnpm run openapi:check` | You changed a controller/DTO but did not commit the regenerated `generated/openapi.json` and `generated/api-types.ts`. Run `pnpm run openapi` and commit the diff. See [openapi.md](./openapi.md). |

### 2.3 Caching

`actions/setup-node@v4` with `cache: pnpm` caches `~/.local/share/pnpm/store` keyed on `pnpm-lock.yaml`. Average cold install: ~30 s. Warm install: ~5 s.

### 2.4 Local reproduction

The exact CI flow can be reproduced locally:

```bash
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm run lint
pnpm exec jest --passWithNoTests
pnpm run build
pnpm run openapi:check
```

---

## 3. `docker-build` workflow

### 3.1 What it does

Builds a Docker image **once per logical service**. Even though the codebase is a single NestJS app today (see roadmap §13.1), the workflow already tags 9 distinct images so the per-service deployment story is ready when the monolith is split.

```yaml
strategy:
  fail-fast: false
  matrix:
    service:
      - auth
      - study
      - learning
      - srs
      - ai
      - classroom
      - search
      - notification
      - analytics
```

Each matrix job:

```yaml
- Checkout
- Set up Docker Buildx                    # docker/setup-buildx-action@v3
- Build image                             # docker/build-push-action@v6
    build-args: SERVICE_NAME=${{ matrix.service }}
    tags:       mimir/${{ matrix.service }}:ci-${{ github.sha }}
    cache-from: type=gha,scope=${{ matrix.service }}
    cache-to:   type=gha,scope=${{ matrix.service }},mode=max
- Smoke-test container                    # image inspect
```

### 3.2 The `SERVICE_NAME` build-arg

[`Dockerfile`](../Dockerfile) accepts a `SERVICE_NAME` build-arg, sets it as a runtime env var, and the app uses it to:

- Label every Prometheus metric with `service="<svc>"`
- Tag every JSON log line with `"service": "<svc>"`
- Drive the future per-service routing once the monolith is split

Today, all 9 images run the same code. Tomorrow, each one will be replaced by a tighter image that only contains the modules it needs — and the CI workflow won't change.

### 3.3 Caching

GitHub Actions cache (`type=gha`) with a per-service scope. Each service caches its own intermediate layers; the matrix builds run in parallel without thrashing the cache.

### 3.4 The smoke test

```bash
docker image inspect mimir/<svc>:ci-<sha> > /dev/null
```

We don't start the container (no Postgres/Redis available in the CI runner without a service container). The inspect is sufficient to prove the image was produced and is valid. A future improvement (see §6) is to spin up Postgres + Redis as workflow `services` and run a real `curl /health`.

---

## 4. Branch protection (recommended)

GitHub repository → Settings → Branches → Branch protection rules → `main`:

| Setting | Value | Why |
|---|---|---|
| Require status checks to pass | ✓ | Blocks merge until CI is green |
| Required checks | `ci / lint-and-test`, `docker-build / Build *` (or just the matrix wildcard) | Forces every PR through the full pipeline |
| Require branches to be up to date | ✓ | Prevents "passes on stale base" surprises |
| Require linear history | optional | Keeps `main` rebase-friendly |
| Require PR review | ≥ 1 | Code review hygiene |
| Restrict force pushes | ✓ | Protects history |
| Restrict deletions | ✓ | Protects branch |

---

## 5. Secrets & permissions

Currently none of the workflows need secrets — they build and test without external services. When the codebase grows:

| When you add | Add secret | Used in |
|---|---|---|
| Image push to a registry | `REGISTRY_TOKEN` + login step | `docker.yml` |
| Coverage upload (Codecov etc.) | `CODECOV_TOKEN` | `ci.yml` |
| Deploy to staging | cloud creds | new `deploy.yml` |
| Anthropic API live test | `ANTHROPIC_API_KEY` | new `e2e.yml` |

Workflow permissions default to read-only (`contents: read`). The minimum-privilege principle: don't widen permissions until a step truly needs them.

---

## 6. Roadmap improvements

The current pipeline is the Sprint 1 deliverable. Items to add in later sprints:

### Sprint 2
- Real **unit test suite** for Auth + JWT. Drop `--passWithNoTests`.
- **Coverage report** uploaded as artifact (or to Codecov).

### Sprint 3–4
- **Integration tests** using GitHub Actions service containers for Postgres + Redis:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env: { POSTGRES_PASSWORD: mimir }
    ports: ['5432:5432']
    options: --health-cmd pg_isready --health-interval 10s
  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
```

### Sprint 5+
- **E2E suite** (Playwright/Supertest) against the built Docker image.
- **Smoke-test** running the Dockerfile image with a real Postgres `services` container — full `curl /health` and `/services/<svc>/health` round-trip.
- **Image push** to GHCR on every `main` push, tagged `latest` + commit SHA.

### Sprint 11+
- **Security scanning**: `trivy` / `grype` on the built image, `npm audit --prod` step.
- **License audit**: `license-checker` (fail on copyleft).
- **CodeQL** static analysis (free for public, paid for private).

### Sprint 12
- **Performance gate**: k6 load test against the staging deploy; fail PR if p95 regresses > 20%.
- **Deploy workflow** to staging on every `main` push, behind a manual `workflow_dispatch` for production.

---

## 7. Debugging a failing run

1. **Click the failing step in the Actions tab**. The first error in red is usually the root cause; subsequent failures are knock-on.
2. **Reproduce locally** with the exact commands from §2.4. Match Node version (`20.x`) and pnpm version (`9.x`).
3. **Inspect the cache** if installs are flaky: re-run with the "Re-run all jobs" → "Enable debug logging" option. Cache hits/misses appear in the log.
4. **Common false positives**:
   - Lint warnings vs errors — only errors fail CI; warnings are informational.
   - `openapi:check` failure on a PR that didn't touch controllers → another PR landed on `main` and changed `generated/`; rebase.
   - Docker matrix flake on one service → re-run only that job (Actions → re-run failed jobs).

---

## 8. File reference

| File | Purpose |
|---|---|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Lint + test + build + OpenAPI check |
| [`.github/workflows/docker.yml`](../.github/workflows/docker.yml) | Per-service Docker build matrix |
| [`Dockerfile`](../Dockerfile) | Multi-stage build with `SERVICE_NAME` arg |
| [`.dockerignore`](../.dockerignore) | Excludes `node_modules`, `dist`, `generated`, `monitoring`, etc. |
| [`package.json`](../package.json) | Defines every script CI runs |
| [`pnpm-lock.yaml`](../pnpm-lock.yaml) | Frozen dependency tree — must be committed |

---

## 9. Adding a new check

```yaml
# .github/workflows/ci.yml
- name: Type-check (no emit)
  run: pnpm exec tsc --noEmit -p tsconfig.json
```

Rules of thumb:

- Add the step **after** the cheapest checks (lint) and **before** the slow ones (Docker)
- Make the failure message self-explanatory (`pnpm run X` should reproduce it locally)
- Don't `continue-on-error: true` to dodge a real failure — add it to the matrix-managed list of known issues instead and open an issue

---

## 10. References

- [GitHub Actions docs](https://docs.github.com/actions)
- [`docker/build-push-action`](https://github.com/docker/build-push-action)
- [Concurrency control](https://docs.github.com/en/actions/using-jobs/using-concurrency)
- [Cache hit/miss debugging](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
