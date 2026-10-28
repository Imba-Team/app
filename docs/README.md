# Mimir — Documentation

Engineering and product documentation for Mimir (NestJS API in `apps/server`, Next.js web app in `apps/web`).

## Features

| Document | What it covers |
|---|---|
| [Technical design (TDD)](./Mimir_TDD_v1.md) | Canonical architecture: modules, data model, queues, search, SRS, deployment |
| [Roadmap v2](./Mimir_Roadmap_v2.md) | Sprint plan and current status (the live backlog is in Linear) |
| [Progress management design](./Mimir_Progress_Management_Design.md) | Mastery model, card progress and study-mode weights |
| [Authentication](./auth.md) | Complete operating manual: every endpoint, every cookie, the RS256 + rotating-refresh model, email verification, Google OAuth, login lockout, throttling, async mail dispatch, runbook |

## Operations & Tooling

| Document | What it covers |
|---|---|
| [Observability — Prometheus, Grafana, Loki](./monitoring.md) | Local monitoring stack, NestJS instrumentation (`/metrics`, JSON logs), dashboards, troubleshooting, production hardening notes |
| [OpenAPI Type Pipeline](./openapi.md) | How `generated/openapi.json` and `generated/api-types.ts` are produced, daily workflow, frontend usage |
| [GitHub Actions CI](./ci.md) | `server-ci`, `web-ci`, `migrations` and `docker-build` workflows, local reproduction, branch protection |

## Product Documentation

| Folder | Contents |
|---|---|
| [Mimir_SRS.md](./Mimir_SRS.md) | Original software requirements spec (the code and OpenAPI win where they differ) |
| [requirements/](./requirements/) | Original SRS and project proposal PDFs (written under the earlier "imba learn" name) |
| [diagrams/](./diagrams/) | Use case, sequence and state diagrams from the original proposal |
