# Mimir Server — Documentation

Engineering documentation for the Mimir backend.

## Operations & Tooling

| Document | What it covers |
|---|---|
| [Observability — Prometheus, Grafana, Loki](./monitoring.md) | Local monitoring stack, NestJS instrumentation (`/metrics`, JSON logs), dashboards, troubleshooting, production hardening notes |
| [OpenAPI Type Pipeline](./openapi.md) | How `generated/openapi.json` and `generated/api-types.ts` are produced, daily workflow, frontend usage |
| [GitHub Actions CI](./ci.md) | `ci.yml` and `docker.yml` walkthrough, per-service Docker matrix, branch-protection setup, roadmap improvements |

## Product Documentation

| Folder | Contents |
|---|---|
| [requirements/](./requirements/) | SRS, project proposal |
| [diagrams/](./diagrams/) | Use case, sequence, and state diagrams |
