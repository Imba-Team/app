# Mimir — Technical Design Document

> **Version:** 1.0.0 | **Based On SRS:** Mimir SRS v1.0 | **Status:** Draft — Engineering Review
> **Classification:** Confidential — Internal Engineering | **Primary Audience:** Engineering Team, Lead Architects

---

## Document Control

### Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | June 2026 | Lead Architect | Initial TDD based on Mimir SRS v1.0 |
| 1.1.0 | TBD | Backend Lead | NestJS module definitions finalised |
| 1.2.0 | TBD | All Engineering Leads | Full technical review pass |
| 1.3.0 | June 2026 | Backend Lead | Added Card Mastery Progress Engine (§5.1.4, §8a). Replaced placeholder `UserProgress` model with concrete `UserCardProgress` + `UserSetProgress`. Formalised `POST /sessions/:id/answer` ingestion contract. |
| 1.4.0 | July 2026 | Lead Architect | **Phase 1 simplification.** Collapsed 9 NestJS microservices into a single modular monolith. Replaced Kubernetes with a managed platform (Fly.io / Railway / Render). Replaced ClickHouse with PostgreSQL + TimescaleDB. Replaced self-hosted MinIO with managed S3 / Cloudflare R2. Removed Kong + Nginx dual-gateway (single reverse-proxy + NestJS-native rate-limit / JWT verify). Native iOS + Android deferred; Phase 1 mobile ships as React Native (Expo) sharing code with the web app. Rationale in §2.2.4–§2.2.8. |

### How to Use This Document

This Technical Design Document (TDD) is the primary engineering reference for building Mimir. It translates the requirements in the SRS into concrete implementation decisions, code patterns, data models, and infrastructure configuration.

- Sections 1–3: Context, technology decisions, repository structure. Read first.
- Sections 4–7: Backend implementation. Primary reference for all backend engineers.
- Sections 8–10: Domain-specific algorithms (SRS, AI, and TTS — §10 is post-MVP; see the deferral banner atop §10).
- Section 11: Frontend architecture. Primary reference for frontend engineers.
- Sections 12–16: Infrastructure concerns (caching, search, storage, queues, WebSocket).
- Sections 17–21: Cross-cutting concerns: security, testing, deployment, performance, error handling.

---

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Technology Stack](#2-technology-stack)
- [3. Repository & Project Structure](#3-repository-project-structure)
- [4. Backend Architecture — Modular Monolith](#4-backend-architecture--modular-monolith)
- [5. Database Design](#5-database-design)
- [6. Authentication & Authorisation](#6-authentication-authorisation)
- [7. API Design Details](#7-api-design-details)
- [8. SRS Algorithm Implementation](#8-srs-algorithm-implementation)
- [8a. Card Mastery Progress Engine](#8a-card-mastery-progress-engine)
- [9. AI Integration](#9-ai-integration)
- [10. TTS Integration *(post-MVP — deferred to v1.1)*](#10-tts-integration)
- [11. Frontend Architecture — React Web App](#11-frontend-architecture-react-web-app)
- [12. Caching Strategy — Redis](#12-caching-strategy-redis)
- [13. Search Implementation — Elasticsearch](#13-search-implementation-elasticsearch)
- [14. Object Storage — Managed S3 / R2](#14-object-storage--managed-s3--cloudflare-r2)
- [15. Background Jobs — BullMQ](#15-background-jobs-bullmq)
- [16. Real-Time Features — Socket.io](#16-real-time-features-socketio)
- [17. Security Implementation](#17-security-implementation)
- [18. Testing Strategy](#18-testing-strategy)
- [19. Deployment & Infrastructure](#19-deployment-infrastructure)
- [20. Performance & Scalability](#20-performance-scalability)
- [21. Error Handling & Logging](#21-error-handling-logging)

---

## 1. Introduction

### 1.1 Purpose

This document defines the technical design for the Mimir platform. It provides architecture decisions, data model definitions, algorithm implementations, API contracts, infrastructure configuration, and coding standards that the engineering team will follow to build the system described in the Mimir Software Requirements Specification (SRS) v1.0.

### 1.2 Scope

This TDD covers the Phase 1 release of Mimir. It does not cover deferred Phase 2 features (gamification, premium subscriptions, content moderation, image support). Placeholder sections note where Phase 2 integrations will be added.

### 1.3 Key Design Principles

| Principle | Application in Mimir |
|---|---|
| Convention over Configuration | NestJS default patterns, Prisma conventions, and standard REST semantics. Engineers should not need to think about plumbing. |
| Explicit over Implicit | Every service boundary is documented. No hidden shared state. TypeScript strict mode enforced everywhere. |
| Fail Fast | Input validation at the API boundary using class-validator. Database constraints enforced. Runtime errors surfaced immediately. |
| Observable by Default | Every service emits structured logs and metrics from day one. No debugging in production without prior instrumentation. |
| Dependency Inversion | Services depend on interfaces, not concrete implementations. AI provider, TTS provider, and storage adapter are all swappable. |
| Twelve-Factor App | Config from environment variables. Stateless services. Dev/prod parity via Docker Compose and Kubernetes. |

### 1.4 Definitions & Acronyms

| Term | Definition |
|---|---|
| TDD | Technical Design Document (this document) |
| SRS | Software Requirements Specification (Mimir SRS v1.0) |
| ORM | Object-Relational Mapper (Prisma in this project) |
| DTO | Data Transfer Object — typed request/response shape validated at the API boundary |
| Guard | NestJS concept: a class that determines if a request should proceed (authentication, roles) |
| Interceptor | NestJS concept: a class that intercepts requests/responses for cross-cutting concerns (logging, transform) |
| BullMQ | Redis-backed job queue library for background processing |
| SM-2 | SuperMemo 2 — the spaced repetition scheduling algorithm used by Mimir SRS |
| TTS | Text-to-Speech — third-party API generating audio from text |
| MinIO | Open-source, S3-compatible object storage used for file and export storage |
| JWT | JSON Web Token — stateless authentication mechanism |
| RBAC | Role-Based Access Control |

---

## 2. Technology Stack

### 2.1 Complete Stack Reference

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| API Framework | NestJS (Fastify adapter) | v10.x | Single modular-monolith NestJS application (9 feature modules — see §4). Fastify adapter is enabled from day one for ~2× throughput on hot paths at zero code cost. NestJS gives us DI, decorators, native Swagger, first-class testing, and clean module boundaries. |
| Runtime | Node.js | v20 LTS | LTS release; stable V8; native ESM + CJS compatibility. |
| Language | TypeScript | v5.x | Strict typing throughout. Each repository maintains its own tsconfig. Frontend types are generated from the backend OpenAPI spec. |
| ORM | Prisma | v5.x | Type-safe database client with auto-generated types from schema. Superior developer experience over TypeORM for new projects. Migrations are explicit SQL. |
| Primary Database | PostgreSQL | v16 | ACID-compliant relational DB. JSON/JSONB support for flexible fields. Full-text search as fallback. Well-supported by Prisma. |
| Cache / Queue | Redis | v7 | Session storage, rate-limit counters, BullMQ job queues, SRS due-date cache, leaderboard sorted sets. |
| Search Engine | Elasticsearch | v8.x | Full-text search with language-aware tokenisation, autocomplete (edge n-gram), and relevance scoring. |
| Analytics store | PostgreSQL + TimescaleDB extension | v16 + v2.x | Phase 1 event volume fits comfortably in Postgres; TimescaleDB hypertables give time-series performance without a second database. ClickHouse is the Phase 2 migration path once event volume passes a query-latency threshold (§2.2.6). |
| Object Storage | Managed S3 (AWS) or Cloudflare R2 | — | Managed S3-compatible storage for exports (CSV, PDF, Anki) and avatars. R2 is preferred for zero-egress pricing. Both share the S3 API, so migration is trivial (§2.2.7). |
| Frontend Framework (Web) | React | v18 | Component model, concurrent rendering. Chosen over Next.js — full SSR/BFF complexity isn't justified for an authenticated app-heavy product; SEO-critical pages will be pre-rendered separately if needed (see §11 for the framework re-evaluation notes). |
| Frontend Build (Web) | Vite | v5.x | Sub-second HMR, ES module-native, superior DX over Webpack/CRA. |
| Mobile (Phase 1) | React Native + Expo (SDK 51+) | Latest | Shares TypeScript, business logic, and study-mode state machines with the web app. Delivers iOS + Android from a single codebase. Native SwiftUI/Compose apps deferred to Phase 2 if UX telemetry demands it (§2.2.8). |
| Frontend State | Zustand + TanStack Query | Latest | Zustand: minimal global state (auth, UI). TanStack Query: server state, caching, background refetch. |
| UI Components | Radix UI + Tailwind CSS | Latest | Radix: unstyled, accessible primitives. Tailwind: utility-first, purged in production. |
| Real-time | Socket.io | v4.x | WebSocket with fallback transports. NestJS gateway adapter available out of the box. |
| Background Jobs | BullMQ | v5.x | Redis-backed job queues. Retry logic, rate limiting, priority queues, cron scheduling built in. |
| Email | SendGrid | Latest API | Transactional email with template support, delivery tracking, and bounce handling. |
| Push Notifications | Firebase Cloud Messaging | v9 | Cross-platform push (iOS, Android, Web) via a single unified API. |
| Auth | Passport.js + @nestjs/jwt | Latest | Strategy-based auth in NestJS. JWT local + OAuth Google + OAuth Apple strategies. |
| Validation | class-validator + class-transformer | Latest | Declarative DTO validation via decorators. Used in NestJS ValidationPipe. |
| Container | Docker | v26 | Multi-stage Dockerfile for a single production image. |
| Hosting Platform | Fly.io (primary) or Railway / Render / AWS ECS | — | Managed container platform with built-in autoscaling, rolling deploys, health checks, and secrets. Removes Kubernetes operational burden for Phase 1. Kubernetes remains the Phase 2 migration path if we outgrow the platform (§2.2.5). |
| CI/CD | GitHub Actions | — | Two pipeline files (backend, web). Docker image pushed to GitHub Container Registry (ghcr.io); web pushed as static bundle to CDN. |
| API Contract | OpenAPI 3.0 + openapi-typescript | — | Backend publishes Swagger spec at /api/docs-json. Frontend generates TypeScript API types from it in CI. |
| Observability | Grafana Cloud (hosted) — Loki logs + Prometheus metrics + Tempo traces | — | Hosted stack avoids running Prometheus / Loki / Tempo ourselves. Free tier covers Phase 1 volume. Self-hosted migration path preserved (same OSS stack). |
| API Docs | Swagger / OpenAPI | v3.0 | Auto-generated via @nestjs/swagger decorators. Served at /api/docs. |

### 2.2 Key Technology Decisions

#### 2.2.1 NestJS on Fastify

NestJS is the backend framework for the entire application. We enable the **Fastify adapter** from day one — same code, roughly 2× throughput on hot paths, and lower memory footprint. Structural benefits:

- Built-in Dependency Injection container eliminates manual wiring.
- Decorator-based Controllers, Guards, Pipes, and Interceptors are self-documenting.
- @nestjs/swagger auto-generates OpenAPI documentation from DTOs and decorators.
- Native WebSocket gateway support via @nestjs/platform-socket.io.
- First-class testing utilities (NestJS Testing module).
- `@fastify/rate-limit`, `@fastify/helmet`, `@fastify/multipart` etc. replace what Kong would have handled at the edge — see §2.2.8.

#### 2.2.2 Prisma over TypeORM

Prisma is selected as the ORM over TypeORM for the following reasons:

| Criterion | Prisma | TypeORM |
|---|---|---|
| Type safety | Full type inference from schema | Requires manual type decorators |
| Migration tooling | Explicit SQL migration files | Auto-sync can silently lose data |
| Query API | Fluent, predictable, no implicit queries | Decorator-heavy, QueryBuilder is verbose |
| Learning curve | Schema-first, intuitive | Decorator-heavy, many footguns |
| Studio (UI) | Prisma Studio built in | Third-party tools only |

#### 2.2.3 BullMQ over Apache Kafka

BullMQ is preferred over Kafka for Phase 1 because Mimir does not yet have the scale that justifies Kafka's operational complexity. BullMQ delivers durable job queues, retry logic, and scheduling with just Redis. Kafka is documented as the Phase 2 migration path for the analytics pipeline once event volume exceeds ~100K events/second.

#### 2.2.4 Modular Monolith over 9 Microservices

Phase 1 ships as a **single NestJS application** organised into nine feature modules (`auth`, `study`, `learning`, `srs`, `ai`, `classroom`, `search`, `notification`, `analytics`). This is the largest structural change from the v1.0–1.3 TDD.

Why:
- The v1.0 TDD had all nine services share one Prisma schema and one PostgreSQL — that is already a distributed monolith. The distribution was purely deployment-topological, not data-topological.
- A modular monolith preserves clean module boundaries (controllers, services, repositories, DTOs remain isolated per module) without the operational cost of nine deployments, nine dashboards, HTTP hops between `learning → srs → study → analytics`, and distributed-transaction cleanup.
- Extraction path is preserved: any module can be lifted into its own service later when its scaling profile diverges. Likely first extraction candidates: `notification` (bursty push traffic), `ai` (Claude latency isolation), `analytics` (write volume once ClickHouse arrives — §2.2.6).

Module-to-module communication is direct NestJS service injection. Async fan-out (e.g. `learning` publishing `session.completed` for `analytics`) still uses BullMQ so the eventual split remains clean.

#### 2.2.5 Managed Platform over Kubernetes

Phase 1 deploys to a managed container platform — **Fly.io as the primary target**, with Railway, Render, or AWS ECS as fallbacks. All four give us:

- Container image → running fleet via one command (`fly deploy`, `railway up`, etc.).
- Built-in rolling deploys, health checks, autoscaling on CPU/RPS, secrets management.
- Regional deployment + private networking to managed Postgres / Redis.
- No cluster to patch, no Helm charts to maintain, no ingress-controller theatre.

Kubernetes remains the Phase 2 migration path when either (a) the platform bill exceeds a dedicated DevOps engineer's cost, or (b) we need control the platform doesn't expose. Until then, the operational savings fund actual product work.

#### 2.2.6 PostgreSQL + TimescaleDB over ClickHouse

Phase 1 analytics events (session started, answer submitted, mastery achieved, page viewed) live in PostgreSQL. TimescaleDB — a Postgres extension — provides hypertables, continuous aggregates, and columnar compression that make time-series queries fast enough for SRS §5.20 dashboards (DAU/WAU/MAU, per-set mastery over time, 90-day heatmaps).

Trigger to migrate to ClickHouse:
- A dashboard query exceeds 500ms P95 at the target event volume, **and** aggregate optimisation in Timescale can't recover it, **or**
- We start ingesting a second, larger event stream (e.g. per-keystroke telemetry) that would blow up Postgres row count.

Backup, replication, upgrades, and monitoring are all Postgres tooling we already run for the primary DB. One stateful system, not two.

#### 2.2.7 Managed Object Storage over Self-Hosted MinIO

Exports (CSV, PDF, Anki .apkg) and user avatars live in **Cloudflare R2** (preferred) or AWS S3. Both expose the S3 API — the same API MinIO exposes — so `@aws-sdk/client-s3` code is identical across all three. R2 has zero egress fees, which matters for exports and public avatars.

Self-hosted MinIO is not chosen because:
- The "no cloud vendor lock-in" argument is weak — MinIO speaks S3, so migration into or out of any provider is a config change, not a rewrite.
- Self-hosted MinIO requires provisioning disk, replication, backup, and monitoring for a stateful service.
- Managed pricing at Phase 1 scale is under $50/month — cheaper than one hour/week of engineer time.

#### 2.2.8 Single Gateway (No Kong)

Phase 1 does not run Kong or a separate API gateway. Instead:

- **TLS + WAF + edge cache**: Cloudflare in front of the app (or the Fly.io built-in edge if we skip Cloudflare).
- **Load balancing**: managed by the platform (Fly.io load balancer / Railway / ECS ALB).
- **Rate limiting**: `@fastify/rate-limit` or NestJS `ThrottlerModule` backed by Redis — meets SRS NFR-SEC (60/min unauth, 600/min auth).
- **JWT verification**: NestJS `JwtAuthGuard` at the controller level.
- **CORS, Helmet, body parsing**: NestJS + Fastify plugins.

Every Kong feature we would have used is handled either at the edge (Cloudflare) or in-process (NestJS + Fastify). Migrating to Kong or a dedicated gateway becomes worthwhile when we have more than one backend service to route between — a Phase 2 problem by construction.

#### 2.2.9 React Native (Expo) over Native iOS + Android

Phase 1 mobile ships as a **React Native app built with Expo (SDK 51+)**, sharing TypeScript, business logic, API client, i18n bundles, and study-mode state machines with the web app in a single monorepo (see §3).

Why:
- Every SRS §5.5–§5.13 study mode would otherwise be implemented three times (web, iOS, Android). Expo lets us implement each mode once.
- Expo EAS Build handles iOS + Android builds and OTA updates without maintaining Xcode / Gradle CI infrastructure.
- Reanimated + Skia give near-native animation performance for the flashcard flip / Match drag interactions — the only truly performance-sensitive UI paths.

Native SwiftUI / Compose apps are deferred to Phase 2, reintroduced only if we observe (a) an App Store review issue tied to RN, (b) a UX metric gap on mobile-first users, or (c) a platform feature (Live Activities, Widgets, complications) that Expo cannot expose.

---

## 3. Repository & Project Structure

### 3.1 Repository Overview

Mimir uses **two Git repositories**: one for the backend monolith, one for the frontend monorepo that contains both web and React Native mobile apps plus shared code.

| Repository | Contents | Primary Language | Deployed As |
|---|---|---|---|
| `mimir-backend` | Single NestJS application (9 feature modules), Prisma schema, infrastructure config. | TypeScript (Node.js) | Docker image on Fly.io / Railway / Render |
| `mimir-app` | pnpm workspace monorepo: React web app (`apps/web`), React Native mobile app (`apps/mobile`), and shared code (`packages/*`) including API client, business logic, i18n, and design tokens. | TypeScript (React + React Native) | Web: static bundle → CDN; Mobile: Expo EAS Build → App Store + Play Store |

> **Rationale**
>
> The backend and frontend have different toolchains, deployment mechanisms, and release cadences, so they stay in separate repos. But the web and mobile apps share ~70% of their code (business logic, API client, study-mode state machines, i18n bundles) — they belong together in one monorepo. The cross-repo contract between `mimir-backend` and `mimir-app` is the OpenAPI spec (see §3.4).

### 3.2 mimir-backend Repository

`mimir-backend` is a **single NestJS application** (Fastify adapter) organised into nine feature modules. There is no `services/` directory and no multi-service topology.

*mimir-backend directory layout*

```
mimir-backend/
├── src/
│   ├── main.ts                     # Bootstrap: Fastify adapter, global pipes, Swagger, versioning
│   ├── app.module.ts               # Root module — imports every feature module
│   ├── config/
│   │   ├── configuration.ts        # ConfigModule setup
│   │   └── env.validation.ts       # Joi schema — throws on startup if env is invalid
│   ├── common/
│   │   ├── guards/                 # JwtAuthGuard, RolesGuard, ThrottlerGuard
│   │   ├── decorators/             # @CurrentUser, @Roles, @Public
│   │   ├── filters/                # HttpExceptionFilter, PrismaExceptionFilter
│   │   ├── interceptors/           # LoggingInterceptor, TimingInterceptor
│   │   └── pipes/                  # Zod/class-validator helpers
│   ├── infrastructure/
│   │   ├── prisma/                 # PrismaService (@Global())
│   │   ├── redis/                  # Redis + BullMQ providers
│   │   ├── storage/                # S3/R2 adapter (via @aws-sdk/client-s3)
│   │   ├── search/                 # Elasticsearch client provider
│   │   └── mail/                   # SendGrid provider
│   ├── modules/                    # 9 feature modules — the actual product
│   │   ├── auth/                   # Registration, login, OAuth, JWT, refresh
│   │   ├── study/                  # Sets, cards, folders, version history, import/export
│   │   ├── learning/               # Session state, mode logic, progress ingestion
│   │   ├── srs/                    # SM-2 scheduling, review queue, retention forecast
│   │   ├── ai/                     # Claude API integration, prompt registry
│   │   ├── classroom/              # Classes, assignments, teacher analytics
│   │   ├── search/                 # Elasticsearch index management + query API
│   │   ├── notification/           # Push (FCM), email (SendGrid), BullMQ workers
│   │   └── analytics/              # Event ingestion, aggregation, dashboard APIs
│   └── health/
│       └── health.controller.ts
├── prisma/
│   ├── schema.prisma               # Single Prisma schema for the whole app
│   ├── migrations/                 # SQL migration files
│   └── seed.ts                     # Local dev seed data
├── test/
│   ├── e2e/                        # Supertest-style end-to-end tests
│   └── factories/                  # user.factory.ts, set.factory.ts, etc.
├── infra/
│   ├── docker-compose.yml          # Local dev stack: postgres + redis + elasticsearch + minio (dev-only S3 stand-in)
│   ├── fly.toml                    # Fly.io deploy config (primary target)
│   └── Dockerfile                  # Single multi-stage Dockerfile
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint + type-check + unit + e2e
│       └── deploy.yml              # Build image + fly deploy on main merge
├── tsconfig.json
├── package.json
└── .env.example
```

#### 3.2.1 Feature Module Internal Structure

Every module in `src/modules/` follows the same layout:

```
src/modules/study/
├── study.module.ts                 # @Module — imports/providers/exports
├── controllers/
│   ├── sets.controller.ts
│   ├── cards.controller.ts
│   └── folders.controller.ts
├── services/
│   ├── sets.service.ts             # Business logic
│   ├── cards.service.ts
│   └── import-export.service.ts
├── repositories/
│   ├── sets.repository.ts          # Thin Prisma wrapper
│   └── cards.repository.ts
├── dto/
│   ├── create-set.dto.ts
│   └── update-card.dto.ts
├── events/                         # BullMQ jobs this module publishes/consumes
│   └── set-indexed.job.ts
└── __tests__/
    └── sets.service.spec.ts
```

Modules **import each other** via NestJS DI (e.g. `LearningModule` imports `SrsModule` and injects `SrsService` directly). No HTTP hops.

For async fan-out that should stay decoupled — `learning` publishing `session.completed` for `analytics` to consume — modules use **BullMQ queues** even though they're in the same process. This preserves clean boundaries and makes the eventual "extract this module into its own service" migration a config change.

### 3.3 mimir-app Repository (Frontend Monorepo)

`mimir-app` is a **pnpm workspace + Turborepo** monorepo containing the web app, the React Native mobile app, and every package they share.

*mimir-app directory layout*

```
mimir-app/
├── apps/
│   ├── web/                        # React 18 + Vite 5 SPA
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── routes/             # React Router v6 route tree
│   │   │   ├── features/           # Web-specific screens (import shared logic from packages/)
│   │   │   ├── components/         # Web-only UI (Radix + Tailwind)
│   │   │   └── lib/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── mobile/                     # React Native + Expo (SDK 51+)
│       ├── app/                    # Expo Router file-based routing
│       ├── components/             # Mobile-only UI (Tamagui or React Native Reusables)
│       ├── app.config.ts           # Expo configuration
│       ├── eas.json                # EAS Build configuration
│       └── package.json
├── packages/                       # Shared code — imported by both apps
│   ├── api-client/                 # Generated types + TanStack Query hooks
│   │   ├── src/
│   │   │   ├── generated/          # AUTO-GENERATED from OpenAPI — do not edit
│   │   │   │   └── api-types.ts
│   │   │   ├── client.ts           # Axios or fetch client with JWT interceptor
│   │   │   └── hooks/              # useMySets(), useCardProgress(), etc.
│   │   └── package.json
│   ├── study-engine/               # Framework-agnostic study-mode state machines (XState)
│   │   ├── src/
│   │   │   ├── learn.machine.ts
│   │   │   ├── write.machine.ts
│   │   │   ├── srs.machine.ts
│   │   │   └── mastery.ts          # Mastery scoring — mirrors backend §8a
│   │   └── package.json
│   ├── i18n/                       # i18next translation resources (all 7 languages)
│   ├── design-tokens/              # Colors, spacing, typography — consumed by Tailwind + Tamagui
│   └── shared-utils/               # Zod schemas, date helpers, formatters
├── scripts/
│   └── generate-api-types.sh       # Fetches OpenAPI spec → packages/api-client/src/generated
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Turbo lint/type-check/test/build (both apps)
│       ├── deploy-web.yml          # Build web + upload to CDN
│       └── deploy-mobile.yml       # eas build --auto-submit on main merge
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

The key win: features like the SM-2 review queue, the mastery reducer, and the write-mode fuzzy-match logic live in `packages/study-engine` and are consumed identically by web and mobile.

### 3.4 Cross-Repository API Contract

The contract between `mimir-backend` and `mimir-app` is the OpenAPI 3.0 spec that NestJS publishes at `/api/docs-json`.

| Step | Tool | Who / When |
|---|---|---|
| 1. Backend emits OpenAPI spec | `@nestjs/swagger` auto-generates from DTO decorators | Automatic — served at `/api/docs-json` on every deploy |
| 2. Frontend generates TS types | `openapi-typescript` (via `scripts/generate-api-types.sh`) | Committed to `packages/api-client/src/generated/`; regenerated in CI + on demand |
| 3. Web + mobile import types | `import type { paths } from '@mimir/api-client'` | At build time |

```bash
# mimir-app/scripts/generate-api-types.sh
#!/bin/bash
set -e

SPEC_URL="${BACKEND_STAGING_URL:-http://localhost:3000}/api/docs-json"
OUT="packages/api-client/src/generated/api-types.ts"

echo "Fetching OpenAPI spec from $SPEC_URL..."
npx openapi-typescript "$SPEC_URL" --output "$OUT"
echo "Types generated at $OUT"
```

Generated files **are committed** to the frontend repo so the build isn't coupled to staging availability.

### 3.5 Local Development

Local dev requires two terminals (backend + frontend). Backend infrastructure (Postgres, Redis, Elasticsearch, dev-only MinIO stand-in for S3) is brought up via Docker Compose.

```bash
# Terminal 1 — start infrastructure (in mimir-backend)
docker compose up -d postgres redis elasticsearch minio

# Terminal 2 — run migrations and start the NestJS app
cd mimir-backend
pnpm prisma migrate dev
pnpm start:dev                     # single NestJS process on :3000

# Terminal 3 — start the web app (in mimir-app)
cd mimir-app
pnpm --filter web dev              # Vite dev server on :5173
# OR: pnpm --filter mobile dev     # Expo dev server + QR code
```

> **MinIO in local dev only.** MinIO speaks the S3 API and stands in for real S3/R2 during local development so nobody needs cloud credentials to run the stack. Production uses managed S3 or R2 (see §14).

> **Environment variables.** Each app has an `.env.example` committed and an `.env` (gitignored). No cross-repo env sharing needed — the frontend only needs `VITE_API_BASE_URL` / `EXPO_PUBLIC_API_URL`.

---

## 4. Backend Architecture — Modular Monolith

Mimir's backend is a **single NestJS application on the Fastify adapter**, organised into nine feature modules. There is no service-to-service HTTP topology.

### 4.1 Application Bootstrap

The single `main.ts` sets up Fastify, global middleware, validation, versioning, and Swagger:

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );

  await app.register(helmet);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const config = new DocumentBuilder()
    .setTitle('Mimir API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
```

### 4.2 Root App Module

The root `AppModule` imports every feature module plus the infrastructure providers. Config and Prisma are `@Global()` so any module can inject them.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { SearchModule } from './infrastructure/search/search.module';
import { MailModule } from './infrastructure/mail/mail.module';

import { AuthModule } from './modules/auth/auth.module';
import { StudyModule } from './modules/study/study.module';
import { LearningModule } from './modules/learning/learning.module';
import { SrsModule } from './modules/srs/srs.module';
import { AiModule } from './modules/ai/ai.module';
import { ClassroomModule } from './modules/classroom/classroom.module';
import { SearchApiModule } from './modules/search/search.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './health/health.module';

import configuration from './config/configuration';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),

    // Infrastructure (all @Global())
    PrismaModule,
    RedisModule,
    StorageModule,
    SearchModule,
    MailModule,

    // Feature modules
    AuthModule,
    StudyModule,
    LearningModule,
    SrsModule,
    AiModule,
    ClassroomModule,
    SearchApiModule,
    NotificationModule,
    AnalyticsModule,

    HealthModule,
  ],
})
export class AppModule {}
```

### 4.3 Module-to-Module Communication

Because everything is in one process, modules communicate via **NestJS dependency injection** — no HTTP, no serialization overhead.

| Communication Type | Mechanism | Use Case |
|---|---|---|
| Synchronous call | Direct DI — `constructor(private srs: SrsService)` | `LearningService` calls `SrsService.updateAfterAnswer()` after a study answer. |
| Async fan-out | BullMQ queue | `LearningService` publishes `session.completed`; `AnalyticsService` worker consumes it. Also `study.set.updated` → `SearchService` reindexer. |
| Real-time push | Socket.io gateway (in-process) | `NotificationGateway` pushes live notifications to connected clients. |
| Scheduled work | BullMQ Cron job | Nightly SRS due-date advancement, weekly progress-summary emails, per-day reminder push. |

**Why BullMQ for in-process events**: keeps the module boundary honest. `AnalyticsService` never gets called synchronously from `LearningService` — the extraction path (splitting `analytics` into its own service when it needs to) becomes a routing config change, not a code refactor.

### 4.4 Feature Module Pattern

All feature modules follow the same layout: **Module → Controller(s) → Service(s) → Repository → DTOs**. Business logic lives in Services; Repositories are thin Prisma wrappers.

```typescript
// src/modules/study/study.module.ts
import { Module } from '@nestjs/common';
import { SetsController } from './controllers/sets.controller';
import { CardsController } from './controllers/cards.controller';
import { SetsService } from './services/sets.service';
import { CardsService } from './services/cards.service';
import { SetsRepository } from './repositories/sets.repository';
import { CardsRepository } from './repositories/cards.repository';

@Module({
  controllers: [SetsController, CardsController],
  providers: [SetsService, CardsService, SetsRepository, CardsRepository],
  exports: [SetsService, CardsService],   // consumed by LearningModule, ClassroomModule
})
export class StudyModule {}

// src/modules/study/repositories/sets.repository.ts — thin Prisma wrapper
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { Prisma, StudySet } from '@prisma/client';

@Injectable()
export class SetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<StudySet | null> {
    return this.prisma.studySet.findUnique({ where: { id } });
  }

  async create(data: Prisma.StudySetCreateInput): Promise<StudySet> {
    return this.prisma.studySet.create({ data });
  }

  async findByOwner(ownerId: string, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.studySet.findMany({
        where: { ownerId, isArchived: false },
        skip: (page - 1) * limit, take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.studySet.count({ where: { ownerId, isArchived: false } }),
    ]);
    return { items, total, page, limit };
  }
}
```

### 4.5 Module Responsibilities & Boundaries

The nine feature modules and their responsibilities. There are no separate ports — everything is mounted under one HTTP server on `PORT` (default 3000).

| Module | Responsibilities | Depends On (injects from) | Async publishes |
|---|---|---|---|
| `auth` | Registration, login, OAuth, JWT issuance, refresh, password reset | (infra only) | `user.registered` |
| `study` | Sets, cards, folders, version history, import/export | `auth` (RolesGuard) | `study.set.updated`, `study.set.deleted` |
| `learning` | Session state, mode logic, answer ingestion, progress engine (§8a) | `study`, `srs`, `ai` | `session.completed`, `card.progress.updated` |
| `srs` | SM-2 scheduling, review queue, retention forecast | `study` | (none — updated by `learning`) |
| `ai` | Claude API integration, prompt registry, rate-limit accounting | (infra only) | `ai.generation.completed` |
| `classroom` | Classes, assignments, teacher analytics | `auth`, `study`, `notification` | `assignment.created`, `assignment.due-soon` |
| `search` | Elasticsearch index management, autocomplete, query API | (subscribes to `study.set.*`) | (none) |
| `notification` | Push (FCM), email (SendGrid), scheduled reminders | `auth` | (none — subscribes to many topics) |
| `analytics` | Event ingestion, aggregation, dashboard APIs | (subscribes to almost everything) | (none) |

**Boundary rule**: a module may only inject services from modules it **explicitly imports** in its `@Module({ imports: [...] })` block, and only services that the other module **explicitly exports**. This is what preserves the extraction path.

---

## 5. Database Design

### 5.1 Prisma Schema

The full Prisma schema lives in packages/prisma/schema.prisma. All services import the generated PrismaClient from this shared package. The complete schema is defined below.

#### 5.1.1 Enums & User

```prisma
// packages/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  output   = "../generated/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  REGISTERED
  TEACHER
  ADMIN
}

enum Visibility {
  PRIVATE
  FOLLOWERS
  PUBLIC
}

model User {
  id                String    @id @default(uuid())
  email             String    @unique
  username          String    @unique
  passwordHash      String?
  displayName       String
  avatarUrl         String?
  bio               String?
  role              UserRole  @default(REGISTERED)
  emailVerified     Boolean   @default(false)
  preferredLanguage String    @default("en")   @db.Char(5)
  timezone          String    @default("UTC")
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  studySets         StudySet[]
  srsCards          SrsCard[]
  cardProgress      UserCardProgress[]   // per-card mastery state, see §5.1.4
  setProgress       UserSetProgress[]    // per-set rollup, see §5.1.4
  collaborations    Collaborator[]
  notifications     Notification[]
  reports           Report[]
  aiGenerations     AiGeneration[]
  following         UserFollow[]   @relation("Follower")
  followers         UserFollow[]   @relation("Followee")
  classMemberships  ClassMembership[]
  taughtClasses     Class[]
  assignmentResults AssignmentResult[]

  @@index([email])
  @@index([username])
}
```

#### 5.1.2 Study Sets & Cards

```prisma
model StudySet {
  id            String      @id @default(uuid())
  ownerId       String
  title         String      @db.VarChar(255)
  description   String?
  languageFrom  String      @db.Char(5)
  languageTo    String?     @db.Char(5)
  visibility    Visibility  @default(PRIVATE)
  category      String?     @db.VarChar(100)
  isArchived    Boolean     @default(false)
  cardCount     Int         @default(0)
  viewCount     Int         @default(0)
  likeCount     Int         @default(0)
  aiGenerated   Boolean     @default(false)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  owner         User        @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  cards         Flashcard[]
  tags          StudySetTag[]
  collaborators Collaborator[]
  versions      SetVersion[]
  assignments   Assignment[]

  @@index([ownerId])
  @@index([visibility])
  @@index([languageFrom, languageTo])
}

// No audioUrl — TTS fetched on-demand. No imageUrl — Phase 2.
model Flashcard {
  id          String    @id @default(uuid())
  setId       String
  position    Int
  term        String
  definition  String
  example     String?
  phonetic    String?   @db.VarChar(200)
  notes       String?
  synonyms    String[]
  translations Json?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  set         StudySet  @relation(fields: [setId], references: [id], onDelete: Cascade)
  srsCards    SrsCard[]

  @@index([setId, position])
  @@unique([setId, position])
}
```

#### 5.1.3 SRS, Progress & Classroom

```prisma
model SrsCard {
  id             String    @id @default(uuid())
  userId         String
  cardId         String
  easeFactor     Decimal   @default(2.50)  @db.Decimal(4,2)
  intervalDays   Int       @default(0)
  repetitions    Int       @default(0)
  dueDate        DateTime  @default(now())  @db.Date
  lastReviewed   DateTime?
  retentionProb  Decimal   @default(1.000)  @db.Decimal(4,3)
  stability      Decimal   @default(1.0)   @db.Decimal(6,2)
  isLeech        Boolean   @default(false)
  lapses         Int       @default(0)
  createdAt      DateTime  @default(now())

  user           User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  card           Flashcard  @relation(fields: [cardId], references: [id], onDelete: Cascade)

  @@unique([userId, cardId])
  @@index([userId, dueDate])
}

model Class {
  id          String    @id @default(uuid())
  teacherId   String
  name        String    @db.VarChar(255)
  joinCode    String    @unique @db.Char(6)
  subject     String?   @db.VarChar(100)
  language    String?   @db.Char(5)
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  teacher     User       @relation(fields: [teacherId], references: [id])
  members     ClassMembership[]
  assignments Assignment[]

  @@index([teacherId])
  @@index([joinCode])
}

model Assignment {
  id              String    @id @default(uuid())
  classId         String
  setId           String
  title           String    @db.VarChar(255)
  dueAt           DateTime
  studyModes      String[]  // e.g. ["FLASHCARDS","LEARN","WRITE"]
  goalMasteryPct  Int       @default(80)
  createdAt       DateTime  @default(now())

  class    Class      @relation(fields: [classId], references: [id], onDelete: Cascade)
  set      StudySet   @relation(fields: [setId], references: [id])
  results  AssignmentResult[]

  @@index([classId, dueAt])
}
```

#### 5.1.4 Card Mastery Progress

The mastery engine (defined in §8a) operates on its own two tables, separate from `SrsCard`. `UserCardProgress` is the per-`(user, card)` mastery state; `UserSetProgress` is a denormalized rollup so set-page reads never need a `COUNT(*)` over thousands of card rows.

```prisma
enum CardMasteryStatus {
  NEW
  LEARNING
  MASTERED
}

model UserCardProgress {
  id              String            @id @default(uuid())
  userId          String
  cardId          String
  setId           String            // denormalized for fast per-set queries
  status          CardMasteryStatus @default(NEW)
  weightedStreak  Decimal           @default(0)  @db.Decimal(5,2)
  correctCount    Int               @default(0)
  incorrectCount  Int               @default(0)
  hintsUsedCount  Int               @default(0)
  timesDemoted    Int               @default(0)   // struggle signal — feeds weak-card lists
  lastStudyMode   String?
  lastAttemptedAt DateTime?
  masteredAt      DateTime?         // set once, on first transition to MASTERED
  updatedAt       DateTime          @updatedAt

  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  card            Flashcard         @relation(fields: [cardId], references: [id], onDelete: Cascade)
  set             StudySet          @relation(fields: [setId],  references: [id], onDelete: Cascade)

  @@unique([userId, cardId])
  @@index([userId, setId, status])
}

// One row per (user, set). Updated transactionally with every UserCardProgress write.
model UserSetProgress {
  userId        String
  setId         String
  totalCards    Int
  newCount      Int       @default(0)
  learningCount Int       @default(0)
  masteredCount Int       @default(0)
  lastStudiedAt DateTime?
  updatedAt     DateTime  @updatedAt

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  set           StudySet  @relation(fields: [setId],  references: [id], onDelete: Cascade)

  @@id([userId, setId])
}
```

> **Schema invariants** — enforced in the Learning Service, not in SQL:
> - `newCount + learningCount + masteredCount == totalCards` for every `UserSetProgress` row.
> - `weightedStreak` is monotonically non-decreasing while `status == MASTERED`, and resets to `0` on any `INCORRECT` answer.
> - `masteredAt` is set only once, on the first NEW/LEARNING → MASTERED transition. Demotions don't clear it; the field records *when the user first reached mastery*, not "is currently mastered" (use `status` for that).

### 5.2 Migration Strategy

- All schema changes are made in schema.prisma and committed with a corresponding migration: pnpm prisma migrate dev --name <description>.
- Migrations generate explicit SQL files in packages/prisma/migrations/. Engineers review SQL before merging.
- Production migrations run via pnpm prisma migrate deploy (no --dev flag) in the CI/CD pipeline before the new pod rolls out.
- Destructive migrations (DROP COLUMN, DROP TABLE) require a two-step deployment: (1) deploy code that no longer reads/writes the column; (2) then drop in a follow-up migration.

### 5.3 Connection Pooling

Each NestJS service maintains its own database connection pool via Prisma. PgBouncer runs as a sidecar container in production for connection multiplexing.

```typescript
// packages/prisma/src/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/client';

@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### 5.4 Indexing Strategy

| Table | Index | Type | Purpose |
|---|---|---|---|
| users | email, username | UNIQUE | Login lookups; username availability checks |
| study_sets | ownerId | BTREE | Fetch user's own sets |
| study_sets | visibility, languageFrom | BTREE | Public set discovery filtered by language |
| study_sets | (title, description) GIN | Full-text GIN | Fallback search when Elasticsearch is unavailable |
| flashcards | (setId, position) | BTREE + UNIQUE | Ordered card fetch for a set |
| srs_cards | (userId, dueDate) | BTREE | Daily SRS queue query — the most frequent query in the system |
| srs_cards | (userId, cardId) | UNIQUE | Prevent duplicate SRS entries per user/card |
| notifications | (userId, readAt) | BTREE | Unread notification count and list |
| assignments | (classId, dueAt) | BTREE | Teacher and student assignment lists ordered by deadline |

---

## 6. Authentication & Authorisation

### 6.1 JWT Strategy

Mimir uses a dual-token pattern: a short-lived access token (15 minutes) and a longer-lived refresh token (30 days stored in an HttpOnly cookie). The Auth Service issues both; all other services validate the access token locally using the public key (RS256).

```typescript
// apps/services/auth/src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;      // user ID
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_PUBLIC_KEY'),
      algorithms: ['RS256'],
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();
    return user; // attached as request.user
  }
}
```

### 6.2 JWT Auth Guard

```typescript
// common/guards/jwt-auth.guard.ts (shared across all services)
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// Usage on a controller:
import { UseGuards, Get } from '@nestjs/common';
@Get()
@UseGuards(JwtAuthGuard)
getMySets() { ... }
```

### 6.3 Roles Guard & Decorator

```typescript
// common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole, Visibility } from '@shared/types';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY, [context.getHandler(), context.getClass()]
    );
    if (!required) return true;
    const { user } = context.switchToHttp().getRequest();
    return required.includes(user.role);
  }
}

// Controller usage:
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER, UserRole.ADMIN)
createClass(@Body() dto: CreateClassDto, @CurrentUser() user: User) { ... }
```

### 6.4 @CurrentUser Decorator

```typescript
// common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// Usage: inject full user object or just one field
createSet(@CurrentUser() user: User)
createSet(@CurrentUser('id') userId: string)
```

### 6.5 OAuth Flow (Google)

```typescript
// Flow summary:
// 1. Client redirects to GET /auth/oauth/google
// 2. Passport redirects to Google consent screen
// 3. Google calls back to GET /auth/oauth/google/callback
// 4. Auth Service: find or create user, issue JWT pair, redirect to web app

import { Strategy } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService, private users: UsersService) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID'),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, _: string, profile: any) {
    const { emails, displayName, photos } = profile;
    return this.users.findOrCreateOAuth({
      email: emails[0].value,
      displayName,
      avatarUrl: photos[0]?.value,
      provider: 'google',
    });
  }
}
```

### 6.6 Refresh Token Flow

Refresh tokens are stored as hashed values in the users table (refreshTokenHash column). On refresh, the plain token is compared against the hash. Refresh tokens are single-use (rotating refresh token pattern): on use, the old hash is replaced with a new one.

| Endpoint | Action | Notes |
|---|---|---|
| POST /auth/login | Issue access token (15m JWT) + refresh token (30d) in HttpOnly cookie. | Refresh token hashed with bcrypt before storage. |
| POST /auth/refresh | Validate refresh token, issue new access token, rotate refresh token. | Old refresh token hash is replaced immediately. |
| POST /auth/logout | Delete refresh token hash from DB; clear cookie. | Access token naturally expires in 15m. |
| POST /auth/logout-all | Delete all refresh tokens for this user (all sessions). | Forces re-login on all devices. |

---

## 7. API Design Details

### 7.1 DTO Pattern

Request bodies and query params are typed as DTO classes using class-validator decorators. Response types use a shared generic wrapper.

```typescript
// modules/sets/dto/create-set.dto.ts
import { IsString, IsEnum, IsOptional, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Visibility } from '@mimir/shared-types';

export class CreateSetDto {
  @ApiProperty({ example: 'Spanish B1 Vocabulary' })
  @IsString() @Length(1, 255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @Length(0, 2000)
  description?: string;

  @ApiProperty({ example: 'en' })
  @IsString() @Matches(/^[a-z]{2}(-[A-Z]{2})?$/)
  languageFrom: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @Matches(/^[a-z]{2}(-[A-Z]{2})?$/)
  languageTo?: string;

  @ApiPropertyOptional({ enum: Visibility, default: Visibility.PRIVATE })
  @IsOptional() @IsEnum(Visibility)
  visibility?: Visibility = Visibility.PRIVATE;
}
```

### 7.2 Pagination

All list endpoints use cursor-based or offset pagination. The standard query params and response shape are defined in @mimir/shared-types:

```typescript
// packages/shared-types/src/pagination.ts
export class PaginationQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 20;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}

// Standard API envelope
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  requestId: string;
}
```

### 7.3 Response Transform Interceptor

A global TransformInterceptor wraps all successful responses in the ApiResponse envelope automatically, so controllers return plain data:

```typescript
// common/interceptors/transform.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const requestId = ctx.switchToHttp().getRequest().headers['x-request-id'] ?? uuid();
    return next.handle().pipe(
      map(data => ({ success: true, data, requestId }))
    );
  }
}
```

### 7.4 Global Exception Filter

```typescript
// common/filters/global-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = req.headers['x-request-id'] as string;

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    if (status >= 500) {
      this.logger.error('Unhandled exception', {
        requestId, path: req.url, status,
        error: exception instanceof Error ? exception.stack : exception,
      });
    }

    res.status(status).json({
      success: false,
      error: { code: this.toErrorCode(status), message },
      requestId,
    });
  }

  private toErrorCode(status: number): string {
    const map: Record<number, string> = {
      400: 'VALIDATION_ERROR', 401: 'UNAUTHORIZED',
      403: 'FORBIDDEN', 404: 'NOT_FOUND',
      409: 'CONFLICT', 422: 'UNPROCESSABLE',
      429: 'RATE_LIMITED', 500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    return map[status] ?? 'UNKNOWN_ERROR';
  }
}
```

---

## 8. SRS Algorithm Implementation

### 8.1 SM-2 Algorithm Overview

The Spaced Repetition System (SRS) implements a modified SM-2 algorithm. Each card per user maintains an ease factor, interval, repetition count, and lapse count. After each review, the next due date is computed based on the user's rating.

| Rating | Enum Value | Meaning | Interval Effect |
|---|---|---|---|
| Again | 0 | Completely forgot | Reset: interval = 1 day, ease_factor -= 0.20, lapses++ |
| Hard | 1 | Recalled with significant difficulty | interval × 0.80; ease_factor -= 0.15 |
| Good | 2 | Recalled correctly with some effort | interval × ease_factor (standard SM-2) |
| Easy | 3 | Recalled instantly and confidently | interval × ease_factor × 1.30; ease_factor += 0.10 |

### 8.2 TypeScript Implementation

```typescript
// apps/services/srs/src/modules/srs/sm2.service.ts
import { Injectable } from '@nestjs/common';
import { SrsCard } from '@prisma/client';

export interface ReviewInput {
  card: SrsCard;
  rating: 0 | 1 | 2 | 3;  // again | hard | good | easy
  reviewedAt: Date;
}

@Injectable()
export class Sm2Service {
  private readonly MIN_EASE = 1.30;
  private readonly DEFAULT_EASE = 2.50;

  processReview({ card, rating, reviewedAt }: ReviewInput): Partial<SrsCard> {
    let { easeFactor, intervalDays, repetitions, lapses } = card;
    const ease = Number(easeFactor);

    if (rating === 0) {
      // Forgot: reset
      intervalDays = 1;
      repetitions = 0;
      lapses += 1;
      easeFactor = Math.max(this.MIN_EASE, ease - 0.20);
    } else {
      // Recalled: advance
      if (repetitions === 0)       intervalDays = 1;
      else if (repetitions === 1)  intervalDays = 6;
      else intervalDays = Math.round(intervalDays * ease);

      if (rating === 1) {    // Hard
        easeFactor = Math.max(this.MIN_EASE, ease - 0.15);
        intervalDays = Math.max(1, Math.round(intervalDays * 0.80));
      } else if (rating === 3) {  // Easy
        easeFactor = ease + 0.10;
        intervalDays = Math.round(intervalDays * 1.30);
      }
      repetitions += 1;
    }

    const dueDate = new Date(reviewedAt);
    dueDate.setDate(dueDate.getDate() + intervalDays);

    // Forgetting curve: R = e^(-elapsed / stability)
    const stability = Math.max(1, intervalDays * Number(easeFactor) / 2.5);
    const retentionProb = Math.exp(-1 / stability);

    return {
      easeFactor,
      intervalDays,
      repetitions,
      lapses,
      dueDate,
      lastReviewed: reviewedAt,
      retentionProb,
      stability,
      isLeech: lapses >= 7,
    };
  }
}
```

### 8.3 Daily Queue Logic

```typescript
// apps/services/srs/src/modules/srs/srs.service.ts

async getDailyQueue(userId: string, limit: number = 50): Promise<QueueCard[]> {
  const today = new Date(); today.setHours(23, 59, 59, 999);

  // 1. Overdue cards (highest priority)
  const overdue = await this.prisma.srsCard.findMany({
    where: { userId, dueDate: { lt: new Date() }, isLeech: false },
    include: { card: true },
    orderBy: { dueDate: 'asc' },
    take: Math.floor(limit * 0.6),
  });

  // 2. Due today
  const dueToday = await this.prisma.srsCard.findMany({
    where: { userId, dueDate: { gte: new Date(), lte: today } },
    include: { card: true },
    orderBy: { retentionProb: 'asc' },  // weakest first
    take: Math.floor(limit * 0.3),
  });

  // 3. New cards (never reviewed: repetitions = 0)
  const prefs = await this.getUserPrefs(userId);
  const newCards = await this.prisma.srsCard.findMany({
    where: { userId, repetitions: 0, dueDate: { lte: today } },
    include: { card: true },
    orderBy: { createdAt: 'asc' },
    take: prefs.newCardsPerDay,
  });

  return this.dedupe([...overdue, ...dueToday, ...newCards]).slice(0, limit);
}
```

### 8.4 30-Day Forecast

```typescript
// Forecast: simulate SM-2 advancement for each active SRS card over 30 days
async getForecast(userId: string): Promise<{ date: string; count: number }[]> {
  const cards = await this.prisma.srsCard.findMany({
    where: { userId, repetitions: { gt: 0 } },
    select: { dueDate: true, intervalDays: true, easeFactor: true },
  });

  const buckets: Record<string, number> = {};
  const today = new Date();

  for (const card of cards) {
    const daysUntilDue = Math.floor(
      (card.dueDate.getTime() - today.getTime()) / 86400000
    );
    if (daysUntilDue >= 0 && daysUntilDue < 30) {
      const key = new Date(today.getTime() + daysUntilDue * 86400000)
        .toISOString().split('T')[0];
      buckets[key] = (buckets[key] ?? 0) + 1;
    }
  }

  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    return { date: key, count: buckets[key] ?? 0 };
  });
}
```

---

## 8a. Card Mastery Progress Engine

Section 8 governs **when** a known card resurfaces. This section governs **whether** a card is "known" in the first place. The two engines run on different timescales: mastery moves over minutes inside a session; SRS moves over days/weeks. They are coupled only by an explicit handoff rule (§8a.6).

Reference design: [docs/Mimir_Progress_Management_Design.md](Mimir_Progress_Management_Design.md). The text below is the authoritative engineering spec.

### 8a.1 State Machine

```
[*] → NEW
NEW       → LEARNING   (first attempt, any outcome)
LEARNING  → LEARNING   (incorrect — weightedStreak resets to 0)
LEARNING  → MASTERED   (weightedStreak ≥ MASTERY_THRESHOLD, default 3.0)
MASTERED  → LEARNING   (any incorrect answer, anywhere)
```

Asymmetry is intentional: forgetting always demotes regardless of mode, but progress toward mastery only comes from trustworthy recall (see weights in §8a.3).

### 8a.2 The CardAttemptEvent — single ingestion shape

Each study mode normalises its outcome into this shape before reaching the engine. **Mode-specific logic (Levenshtein matching, MC scoring, etc.) stays in each mode's controller — the engine only sees the normalised event.**

```typescript
// apps/services/learning/src/modules/progress/card-attempt.event.ts
export type StudyMode =
  | 'FLASHCARD' | 'LEARN_MC' | 'LEARN_WRITTEN'
  | 'WRITE' | 'SPELL'
  | 'TEST_WRITTEN' | 'TEST_MC' | 'TEST_TF'
  | 'AI_FILL_BLANK' | 'AI_GUESS_WORD'
  | 'MATCH'; // ingested but never affects mastery (see §8a.3)

export type AttemptOutcome = 'CORRECT' | 'INCORRECT' | 'SKIPPED';

export interface CardAttemptEvent {
  attemptId: string;       // client-generated UUID for idempotency
  userId: string;
  cardId: string;
  setId: string;
  sessionId: string;
  studyMode: StudyMode;
  outcome: AttemptOutcome;
  hintUsed: boolean;
  attemptedAt: Date;
}
```

### 8a.3 Mode Weights

| Study mode | Weight (no hint) | Weight (hint used) |
|---|---|---|
| `FLASHCARD` (self-report "Know it") | 0.5 | 0.25 |
| `LEARN_MC` | 0.5 | 0.25 |
| `LEARN_WRITTEN` | 1.0 | 0.5 |
| `WRITE` | 1.0 | 0.5 |
| `SPELL` | 1.0 | 0.5 |
| `TEST_WRITTEN` | 1.0 | 0.5 |
| `TEST_MC` | 0.5 | 0.25 |
| `TEST_TF` | 0.3 | 0.15 |
| `AI_FILL_BLANK` | 1.0 | 0.5 |
| `AI_GUESS_WORD` | 1.0 | 0.5 |
| `MATCH` | **not counted** | **not counted** |

Match Game is logged for engagement analytics but never affects mastery — speed/drag-and-drop has too little evidentiary value, and counting it would let users farm mastery by replaying it.

### 8a.4 Update Algorithm (pure function)

```typescript
// apps/services/learning/src/modules/progress/apply-attempt.ts
import { CardAttemptEvent } from './card-attempt.event';

export const MASTERY_THRESHOLD = 3.0;

const MODE_WEIGHT: Record<StudyMode, number> = {
  FLASHCARD: 0.5, LEARN_MC: 0.5, LEARN_WRITTEN: 1.0,
  WRITE: 1.0, SPELL: 1.0,
  TEST_WRITTEN: 1.0, TEST_MC: 0.5, TEST_TF: 0.3,
  AI_FILL_BLANK: 1.0, AI_GUESS_WORD: 1.0,
  MATCH: 0,
};

export interface ProgressState {
  status: 'NEW' | 'LEARNING' | 'MASTERED';
  weightedStreak: number;
  correctCount: number;
  incorrectCount: number;
  hintsUsedCount: number;
  timesDemoted: number;
  masteredAt: Date | null;
}

export function applyAttempt(
  prev: ProgressState,
  event: CardAttemptEvent,
): { next: ProgressState; graduated: boolean; demoted: boolean } {
  if (event.outcome === 'SKIPPED') return { next: prev, graduated: false, demoted: false };

  if (event.outcome === 'INCORRECT') {
    const demoted = prev.status === 'MASTERED';
    return {
      next: {
        ...prev,
        status: 'LEARNING',
        weightedStreak: 0,
        incorrectCount: prev.incorrectCount + 1,
        timesDemoted: demoted ? prev.timesDemoted + 1 : prev.timesDemoted,
      },
      graduated: false,
      demoted,
    };
  }

  // CORRECT
  const base = MODE_WEIGHT[event.studyMode] ?? 0;
  if (base === 0) {
    // Match Game etc. — still count "seen" elsewhere; mastery untouched.
    return { next: prev, graduated: false, demoted: false };
  }
  const credit = event.hintUsed ? base * 0.5 : base;
  const newStreak = prev.weightedStreak + credit;
  const reachedMastery = newStreak >= MASTERY_THRESHOLD;
  const graduated = reachedMastery && prev.status !== 'MASTERED';

  return {
    next: {
      ...prev,
      status: reachedMastery ? 'MASTERED' : 'LEARNING',
      weightedStreak: newStreak,
      correctCount: prev.correctCount + 1,
      hintsUsedCount: prev.hintsUsedCount + (event.hintUsed ? 1 : 0),
      masteredAt: graduated ? new Date() : prev.masteredAt,
    },
    graduated,
    demoted: false,
  };
}
```

### 8a.5 Persistence — single transactional path

Each accepted event triggers exactly one transaction:

1. Idempotency check — `attemptId` is looked up in Redis (`SETNX progress:attempt:{attemptId} 1 EX 600`). On hit, the event is dropped and the **last known** progress is returned to the client.
2. `prisma.$transaction([...])`:
   - `UPSERT UserCardProgress` with the result of `applyAttempt`.
   - Adjust `UserSetProgress` counters by the status delta (e.g., NEW→LEARNING ⇒ `newCount -= 1`, `learningCount += 1`).
   - If `graduated`: emit a `CARD_GRADUATED` domain event (in-process for MVP; BullMQ for fan-out later).
3. Invalidate the `set-mastery:{userId}:{setId}` cache key.

All writes go through this path. **There is no other code path that mutates mastery state.**

### 8a.6 Handoff to SM-2 (Section 8)

| Trigger | Mastery side | SM-2 side |
|---|---|---|
| First time `status` transitions to `MASTERED` (graduation) | `masteredAt := now()` | Create `SrsCard` row with SM-2 defaults (`easeFactor=2.50`, `intervalDays=0`, `repetitions=0`, `dueDate=now()`). |
| Incorrect answer on a card with an existing `SrsCard` row — anywhere (in-session or in a formal SRS review) | Demote: `status=LEARNING`, `weightedStreak=0`. | Apply rating `0` (Again) via `Sm2Service.processReview`. Resets `intervalDays=1`, `dueDate=tomorrow`. |
| Correct answer **outside** the dedicated SRS review session | Updates mastery normally. | **No-op.** Casual correct repeats must not extend SM-2 intervals — only Again/Hard/Good/Easy ratings inside the SRS review flow do. |
| Explicit SRS review rating (Again/Hard/Good/Easy) | If `Again`, also demote mastery. | Standard SM-2 update (see §8.2). |

This is the **only** coupling between the two engines. Don't add others without an explicit ADR.

### 8a.7 API Contract — `POST /sessions/:id/answer`

The Learning Service exposes a single ingestion endpoint. Every mode's controller calls it after the mode has produced its outcome.

**Request:**

```http
POST /sessions/:sessionId/answer
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "attemptId": "8c4f...e2",       // client-generated UUID, used for idempotency
  "cardId": "...",
  "studyMode": "WRITE",
  "outcome": "CORRECT",
  "hintUsed": false,
  "attemptedAt": "2026-07-15T10:32:11Z"
}
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "cardProgress": {
      "status": "LEARNING",
      "weightedStreak": 1.5,
      "graduated": false,
      "demoted": false
    },
    "setProgress": {
      "totalCards": 30,
      "newCount": 8,
      "learningCount": 10,
      "masteredCount": 12
    }
  }
}
```

The set rollup is returned in the same response so the UI's progress bar can update without a second round trip.

### 8a.8 Append-only attempt log (analytics)

The hot path never reads attempt history. A separate `CardAttemptEvent` is BullMQ-published to the analytics consumer (Section 11 in the roadmap), which persists it into ClickHouse for "weak cards", session analytics, and tuning the weights. Treat the log as write-and-forget — if the queue is down, the hot path still succeeds.

### 8a.9 Tunable Parameters

| Parameter | Default | Where stored | Notes |
|---|---|---|---|
| `MASTERY_THRESHOLD` | 3.0 | Code constant (MVP); `system_config` row (v1.1) | Three recall-grade correct answers, or six recognition-grade, get a card to MASTERED. |
| Recall weight | 1.0 | Code constant | Write / Spell / Learn-written / Test-written / both AI modes. |
| Recognition weight | 0.5 | Code constant | Learn-MC / Test-MC / Flashcards self-report. |
| True/False weight | 0.3 | Code constant | Highly guessable. |
| Hint multiplier | × 0.5 | Code constant | Applied on top of base. |

Same disposition as SM-2's ease-factor defaults (see R-03 in the roadmap risk register): ship with these, tune after first 1,000 users using the attempt log.

### 8a.10 What this engine deliberately does **not** do

- It does not schedule reviews. That's SM-2's job (§8).
- It does not store per-attempt history on the hot path. Use the analytics log.
- It does not allow mode-specific exceptions to the algorithm. If a mode needs different credit, edit the weight table — don't branch in `applyAttempt`.
- It does not have a separate "mastery service". It lives inside the Learning Service module (§4.4 feature module pattern).

---

## 9. AI Integration

### 9.1 Anthropic Client Setup

```typescript
// apps/services/ai/src/modules/ai/anthropic.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AnthropicService {
  private readonly client: Anthropic;
  private readonly model = 'claude-sonnet-4-6';
  private readonly logger = new Logger(AnthropicService.name);

  constructor(private config: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.config.getOrThrow('ANTHROPIC_API_KEY'),
    });
  }

  async complete(systemPrompt: string, userPrompt: string,
    maxTokens = 1000): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type');
    return block.text;
  }
}
```

### 9.2 Feature 1 — AI Flashcard Generation

#### 9.2.1 System Prompt

```typescript
// apps/services/ai/src/modules/ai/prompts/flashcard-generation.prompt.ts
export const FLASHCARD_SYSTEM_PROMPT = `
You are a vocabulary expert and language teacher.
Generate a study set of vocabulary flashcards in valid JSON only.
No preamble, no explanation, no markdown fences — output ONLY the JSON array.

Each card must have exactly these fields:
  "term"       – the vocabulary term (in source language)
  "definition" – clear, concise definition (in target language)
  "example"    – one natural sentence using the term in context
  "phonetic"   – IPA pronunciation or phonetic guide (if applicable)

Rules:
- Definitions must be concise (max 120 characters)
- Examples must be natural-sounding and diverse across the set
- Terms must be distinct — no duplicates
- Output format: [{"term":"...","definition":"...","example":"...","phonetic":"..."}, ...]
`;
```

#### 9.2.2 Generation Service

```typescript
// apps/services/ai/src/modules/ai/flashcard-gen.service.ts
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface GenerateFlashcardsDto {
  topic?: string;
  text?: string;
  languageFrom: string;
  languageTo: string;
  count: number;  // max 50
}

@Injectable()
export class FlashcardGenService {
  constructor(
    private readonly anthropic: AnthropicService,
    private readonly rateLimiter: AiRateLimiterService,
  ) {}

  async generate(userId: string, dto: GenerateFlashcardsDto) {
    await this.rateLimiter.checkOrThrow(userId, 'flashcard_gen');

    const userPrompt = dto.topic
      ? `Generate ${dto.count} flashcards for the topic: "${dto.topic}". ` +
        `Source language: ${dto.languageFrom}. Target/definition language: ${dto.languageTo}.`
      : `Extract and generate ${dto.count} flashcards from this text:

${dto.text}

` +
        `Source: ${dto.languageFrom}. Definitions in: ${dto.languageTo}.`;

    try {
      const raw = await this.anthropic.complete(
        FLASHCARD_SYSTEM_PROMPT, userPrompt, 4096
      );

      // Strip accidental markdown fences
      const cleaned = raw.replace(/```[a-z]*\n?|```/g, '').trim();
      const cards = JSON.parse(cleaned);

      if (!Array.isArray(cards)) throw new Error('Not an array');
      await this.rateLimiter.record(userId, 'flashcard_gen', cards.length);

      return cards.slice(0, dto.count);
    } catch (err) {
      throw new ServiceUnavailableException(
        'AI service temporarily unavailable. Please try again.'
      );
    }
  }
}
```

### 9.3 Feature 2 — Fill-in-the-Blank Mode

#### 9.3.1 Prompt Template

```typescript
export const FILL_BLANK_PROMPT = (term: string, definition: string, language: string) => ({
  system: `You are a language learning assistant. Generate fill-in-the-blank sentences.
  Output ONLY the sentence — no explanation, no quotes, no labels.`,
  user: `Create one natural sentence in {language} that uses the word "{term}" (meaning: {definition}).
  Replace the word {term} in the sentence with exactly five underscores: _____.
  The sentence should make the word's meaning clear from context.
  Output the sentence with the blank only.`,
});

// Example output:
// 'She examined the ancient _____ with great curiosity in the museum.'
```

#### 9.3.2 Evaluation Logic

```typescript
// Levenshtein distance for typo-tolerant evaluation
function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 },
    (_, i) => Array.from({ length: b.length + 1 }, (_, j) => i || j)
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

export function evaluateAnswer(guess: string, term: string): 'correct' | 'close' | 'wrong' {
  const g = guess.trim().toLowerCase();
  const t = term.trim().toLowerCase();
  if (g === t) return 'correct';
  const maxDist = t.length >= 6 ? 1 : 0;  // 1 typo allowed for 6+ char words
  return levenshtein(g, t) <= maxDist ? 'close' : 'wrong';
}
```

### 9.4 Feature 3 — Guess the Word Mode

#### 9.4.1 Prompt Template

```typescript
export const GUESS_WORD_PROMPT = (
  term: string, definition: string, synonyms: string[], language: string
) => ({
  system: `You are a creative vocabulary game host.
  Write a clue description that helps players guess a word.
  NEVER use the target word, its synonyms, or any direct translation in your description.
  Output ONLY the description paragraph — no labels, no title.`,
  user: `Write a 2-4 sentence clue description for the ${language} word "${term}".
  Definition: ${definition}
  Do NOT use these words: ${[term, ...synonyms].join(', ')}
  Style: engaging, descriptive, like a well-crafted riddle.
  Include: what the word refers to, typical contexts where it is used, how it feels or what it implies.`,
});

// Example (term: "serendipity"):
// "This word describes the pleasant experience of discovering something valuable
//  or delightful by chance, without actively searching for it. It captures
//  those fortunate accidents that feel like gifts from the universe."
```

#### 9.4.2 Hint Generation

```typescript
// Hint = second, more explicit clue generation call
export const GUESS_WORD_HINT_PROMPT = (term: string, definition: string) => ({
  system: `You are a vocabulary game host giving a helpful hint.
  Output ONLY the hint sentence — nothing else.`,
  user: `Give one additional hint for guessing "${term}" (meaning: ${definition}).
  The hint should be more direct but still not say the word.
  Use a sentence pattern like "This word starts with..." or "You might use this word when..."`,
});
```

### 9.5 Rate Limiting & Cost Control

```typescript
// apps/services/ai/src/modules/ai/ai-rate-limiter.service.ts
import { Injectable, TooManyRequestsException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

@Injectable()
export class AiRateLimiterService {
  // Daily limits per user (configurable via env)
  private readonly LIMITS = {
    flashcard_gen: 20,   // sets per day
    fill_blank: 200,     // cards per day
    guess_word: 200,     // cards per day
  };

  constructor(@InjectRedis() private redis: Redis) {}

  async checkOrThrow(userId: string, feature: string): Promise<void> {
    const key = `ai:rate:${userId}:${feature}:${this.todayKey()}`;
    const current = await this.redis.get(key);
    if (current && parseInt(current) >= this.LIMITS[feature]) {
      throw new TooManyRequestsException(
        `Daily AI limit reached for ${feature}. Resets at midnight.`
      );
    }
  }

  async record(userId: string, feature: string, count = 1): Promise<void> {
    const key = `ai:rate:${userId}:${feature}:${this.todayKey()}`;
    await this.redis.incrby(key, count);
    await this.redis.expireat(key, this.tomorrowMidnightUnix());
  }

  private todayKey() { return new Date().toISOString().split('T')[0]; }

  private tomorrowMidnightUnix(): number {
    const d = new Date(); d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }
}
```

> **AI Error Handling Policy**
>
> All three AI features implement a graceful fallback. If the Anthropic API returns an error or exceeds the 8-second timeout, the AI mode falls back to a standard Write Mode question for that card. The user sees a subtle "AI unavailable for this card — showing standard mode" indicator. No session is interrupted by AI failures.

---

## 10. TTS Integration

> **⚠ Deferred to post-MVP (v1.1).** No TTS code ships in v1.0. The design below is preserved as the intended implementation for when the feature is re-scoped — do not build against it during MVP sprints. Spell Mode (which depends on this) is deferred with it. See the roadmap Post-MVP scope table for the v1.1 slot.

### 10.1 Architecture Overview

TTS is a client-side feature. The web and mobile apps call the Mimir API, which proxies the TTS provider API, adding authentication and rate limiting. Audio bytes are streamed back to the client. No audio is stored on disk or in the database.

*TTS flow*

```
// Flow:
// Client clicks speaker button on a card
// → GET /tts?term=serendipity&language=en&speed=1.0
// → Study Service validates JWT, checks rate limit
// → Study Service calls TTS Provider API (Google TTS or ElevenLabs)
// → Audio bytes streamed back as audio/mpeg
// → Client plays audio; browser caches response by URL (Cache-Control: public, max-age=86400)
```

### 10.2 TTS Controller

```typescript
// apps/services/study/src/modules/tts/tts.controller.ts
@Get('tts')
@UseGuards(JwtAuthGuard)
async getTts(
  @Query('term') term: string,
  @Query('language') language: string,
  @Query('speed') speed: number = 1.0,
  @CurrentUser('id') userId: string,
  @Res() res: Response,
): Promise<void> {
  await this.ttsRateLimiter.checkOrThrow(userId);

  const audioBuffer = await this.ttsService.synthesise({ term, language, speed });

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-TTS-Provider', this.ttsService.providerName);
  res.end(audioBuffer);
}
```

### 10.3 Provider Abstraction

The TTS provider is abstracted behind an interface so it can be swapped without changing any controller or business logic:

```typescript
// modules/tts/tts.interface.ts
export interface TtsSynthesiseInput {
  term: string;
  language: string;  // BCP-47 code: "en-US", "fr-FR"
  speed: number;     // 0.5 – 2.0
}

export interface ITtsProvider {
  readonly providerName: string;
  synthesise(input: TtsSynthesiseInput): Promise<Buffer>;
}

// modules/tts/providers/google-tts.provider.ts
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

@Injectable()
export class GoogleTtsProvider implements ITtsProvider {
  readonly providerName = 'google-tts';
  private client = new TextToSpeechClient();

  async synthesise({ term, language, speed }: TtsSynthesiseInput): Promise<Buffer> {
    const [response] = await this.client.synthesizeSpeech({
      input: { text: term },
      voice: { languageCode: language, ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: speed },
    });
    return Buffer.from(response.audioContent as Uint8Array);
  }
}

// Swap to ElevenLabs by replacing provider in module — no other changes needed.
```

### 10.4 Rate Limiting

TTS is rate-limited per user session to prevent runaway API costs. The limit is 200 TTS calls per 30-minute rolling window per user, enforced via a Redis sliding window counter.

| Configuration | Value | Notes |
|---|---|---|
| Max calls / 30-min window | 200 | Covers a typical Flashcard or Spell Mode session |
| Cooldown on limit breach | 30 minutes | Window slides; block lifted when oldest call exits window |
| Cache TTL (browser) | 86400 seconds (24h) | Cache-Control: public, max-age=86400 on response |
| Fallback behaviour | Return 429 with Retry-After header | Client shows "Audio temporarily unavailable" button state |

---

## 11. Frontend Architecture — React Web App

### 11.1 Directory Structure

*Web app directory structure*

```
mimir-web/src/                        # Standalone React repo (mimir-web)
├── main.tsx                      # Vite entry: ReactDOM.createRoot
├── App.tsx                       # Root: QueryClientProvider, Router, Toaster
├── routes/                       # React Router v6 route tree
│   ├── index.tsx                 # Route definitions (lazy imports)
│   ├── auth/                     # /login, /register, /forgot-password
│   ├── dashboard/                # / (home)
│   ├── library/                  # /library, /library/folders/:id
│   ├── sets/                     # /sets/:id, /sets/:id/edit
│   ├── study/                    # /sets/:id/study/:mode
│   ├── classroom/                # /classroom, /classroom/:id
│   ├── progress/                 # /progress
│   ├── discover/                 # /discover
│   └── profile/                  # /profile/:username
├── features/                     # Feature-scoped modules
│   ├── auth/                     # AuthContext, login form, OAuth buttons
│   ├── sets/                     # Set editor, card list, import modal
│   ├── study/                    # All study mode components
│   │   ├── modes/
│   │   │   ├── FlashcardsMode.tsx
│   │   │   ├── LearnMode.tsx
│   │   │   ├── WriteMode.tsx
│   │   │   ├── SpellMode.tsx     # post-MVP (needs TTS)
│   │   │   ├── TestMode.tsx
│   │   │   ├── MatchMode.tsx
│   │   │   ├── AiFillBlankMode.tsx
│   │   │   └── AiGuessWordMode.tsx
│   │   ├── SessionProvider.tsx   # Session state + answer submission
│   │   └── AudioButton.tsx       # TTS trigger button (post-MVP)
│   ├── srs/
│   ├── classroom/
│   ├── ai/
│   └── analytics/
├── components/                   # Shared UI components (design system)
│   ├── ui/                       # Radix UI + Tailwind primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── ... (30+ components)
│   └── layout/
│       ├── Sidebar.tsx
│       ├── Topbar.tsx
│       └── PageWrapper.tsx
├── hooks/                        # Custom React hooks
│   ├── useAuth.ts
│   ├── useStudySession.ts
│   ├── useTts.ts                 # post-MVP (see §10)
│   └── useSrsQueue.ts
├── store/                        # Zustand stores
│   ├── auth.store.ts             # currentUser, isAuthenticated
│   └── ui.store.ts               # sidebarOpen, theme, toast queue
│   ├── api/
│   │   ├── client.ts                     # axios instance with JWT interceptor
│   │   ├── generated/
│   │   │   └── api-types.ts              # AUTO-GENERATED from backend OpenAPI spec
│   │   │   │                             # Run: pnpm run generate:types
│   │   ├── sets.api.ts
│   │   ├── learning.api.ts
│   │   ├── srs.api.ts
│   │   └── ai.api.ts
├── scripts/
│   └── generate-api-types.sh             # Fetches /api/docs-json; runs openapi-typescript
└── lib/                          # Utilities: cn(), formatDate(), etc.
```

### 11.2 API Layer & JWT Interceptor

```typescript
// src/api/client.ts
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,  // send HttpOnly refresh token cookie
});

// Attach access token to every request
client.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: any[] = [];

client.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise((res, rej) => failedQueue.push({ res, rej }));
      }
      isRefreshing = true;
      try {
        const { data } = await axios.post('/auth/refresh', {}, { withCredentials: true });
        useAuthStore.getState().setAccessToken(data.accessToken);
        failedQueue.forEach(p => p.res(client(p.config)));
        failedQueue = [];
        return client(original);
      } catch { useAuthStore.getState().logout(); }
      finally { isRefreshing = false; }
    }
    return Promise.reject(err);
  }
);

export default client;
```

### 11.3 Study Session State

```typescript
// features/study/SessionProvider.tsx — shared state for all study modes
import { createContext, useContext, useReducer } from 'react';

interface SessionState {
  cards: Card[];
  currentIndex: number;
  correct: number;
  incorrect: number;
  sessionId: string;
  isComplete: boolean;
}

type Action = { type: 'ANSWER'; correct: boolean }
            | { type: 'NEXT' }
            | { type: 'COMPLETE' };

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'ANSWER': return {
      ...state,
      correct: action.correct ? state.correct + 1 : state.correct,
      incorrect: !action.correct ? state.incorrect + 1 : state.incorrect,
    };
    case 'NEXT': return {
      ...state,
      currentIndex: state.currentIndex + 1,
      isComplete: state.currentIndex + 1 >= state.cards.length,
    };
    case 'COMPLETE': return { ...state, isComplete: true };
    default: return state;
  }
}
```

### 11.4 TTS Hook *(post-MVP — ships with §10)*

> Not implemented in v1.0. Preserved as the intended shape for when TTS lands in v1.1.

```typescript
// hooks/useTts.ts
import { useCallback, useRef } from 'react';
import client from '../api/client';

export function useTts() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (term: string, language: string, speed = 1.0) => {
    const url = `/tts?term=${encodeURIComponent(term)}&language=${language}&speed=${speed}`;
    if (audioRef.current) { audioRef.current.pause(); }
    const audio = new Audio(url);
    audioRef.current = audio;
    await audio.play().catch(() => {
      // Browser may block autoplay — show error indicator
      console.warn('TTS playback blocked by browser');
    });
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  return { speak, stop };
}
```

---

## 12. Caching Strategy — Redis

### 12.1 Redis Key Map

| Key Pattern | Type | TTL | Stores | Invalidated When |
|---|---|---|---|---|
| session:access:{userId}:{jti} | String | 15m | JWT jti for blacklist checks | On logout |
| refresh:{userId} | String | 30d | Hashed refresh token | On logout / rotation |
| rate:api:{userId}:{minute} | String | 60s | Request count for rate limiter | Auto-expires |
| rate:tts:{userId}:{window} *(post-MVP)* | String | 30m | TTS call count in sliding window — ships with §10 in v1.1 | Auto-expires |
| rate:ai:{userId}:{feature}:{date} | String | 24h | Daily AI generation count | Auto-expires midnight |
| srs:queue:{userId}:{date} | String (JSON) | 24h | Pre-computed daily SRS queue | On any SRS card update for user |
| set:preview:{setId} | String (JSON) | 10m | First 10 cards of a public set | On set update |
| search:autocomplete:{prefix} | ZSet | 5m | Autocomplete suggestions for prefix | On Elasticsearch sync |
| leaderboard:weekly | ZSet | 7d | Global XP leaderboard (Phase 2) | Weekly cron reset |
| user:profile:{username} | String (JSON) | 5m | Public profile data | On profile update |

### 12.2 Redis Configuration in NestJS

```typescript
// app.module.ts — Redis module registration
import { RedisModule } from '@nestjs-modules/ioredis';

RedisModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    type: 'single',
    url: config.getOrThrow('REDIS_URL'),
    options: {
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    },
  }),
  inject: [ConfigService],
}),

// Inject in any service:
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

@Injectable()
export class SomeService {
  constructor(@InjectRedis() private redis: Redis) {}
}
```

### 12.3 Cache-Aside Pattern

All caching in Mimir uses the cache-aside (lazy loading) pattern — the service checks the cache first, fetches from the database on miss, and populates the cache for subsequent requests. Cache invalidation is explicit and triggered by write operations.

```typescript
// Pattern: cache-aside in a service method
async getPublicSet(setId: string): Promise<StudySetDto> {
  const key = `set:preview:${setId}`;
  const cached = await this.redis.get(key);
  if (cached) return JSON.parse(cached);

  const set = await this.setsRepository.findPublicById(setId);
  if (!set) throw new NotFoundException();

  await this.redis.setex(key, 600, JSON.stringify(set)); // 10 min TTL
  return set;
}

// Invalidation on update:
async updateSet(setId: string, dto: UpdateSetDto): Promise<StudySet> {
  const updated = await this.setsRepository.update(setId, dto);
  await this.redis.del(`set:preview:${setId}`);  // explicit invalidation
  return updated;
}
```

---

## 13. Search Implementation — Elasticsearch

### 13.1 Index Design

| Index | Primary Fields | Analyser | Purpose |
|---|---|---|---|
| mimir_sets | title, description, tags, languageFrom, languageTo, ownerId, visibility | Standard + edge_ngram for title | Full-text study set search |
| mimir_users | username, displayName, bio | Standard | User search and autocomplete |

### 13.2 mimir_sets Index Mapping

```json
{
  "mappings": {
    "properties": {
      "id":           { "type": "keyword" },
      "title":        { "type": "text", "analyzer": "standard",
                        "fields": { "autocomplete": {
                          "type": "text", "analyzer": "edge_ngram_analyzer" } } },
      "description":  { "type": "text", "analyzer": "standard" },
      "tags":         { "type": "keyword" },
      "category":     { "type": "keyword" },
      "languageFrom": { "type": "keyword" },
      "languageTo":   { "type": "keyword" },
      "ownerId":      { "type": "keyword" },
      "ownerUsername":{ "type": "keyword" },
      "visibility":   { "type": "keyword" },
      "cardCount":    { "type": "integer" },
      "likeCount":    { "type": "integer" },
      "createdAt":    { "type": "date" },
      "updatedAt":    { "type": "date" }
    }
  },
  "settings": {
    "analysis": {
      "analyzer": {
        "edge_ngram_analyzer": {
          "type": "custom",
          "tokenizer": "edge_ngram_tokenizer",
          "filter": ["lowercase"]
        }
      },
      "tokenizer": {
        "edge_ngram_tokenizer": {
          "type": "edge_ngram",
          "min_gram": 2, "max_gram": 20,
          "token_chars": ["letter", "digit"]
        }
      }
    }
  }
}
```

### 13.3 Search Query Pattern

```typescript
// apps/services/search/src/modules/search/search.service.ts
async searchSets(query: string, filters: SearchFiltersDto, page: number, limit: number) {
  const must: any[] = [
    { multi_match: { query, fields: ['title^3', 'description', 'tags^2'], fuzziness: 'AUTO' } }
  ];
  const filter: any[] = [
    { term: { visibility: 'PUBLIC' } },
  ];
  if (filters.languageFrom) filter.push({ term: { languageFrom: filters.languageFrom } });
  if (filters.category)     filter.push({ term: { category: filters.category } });

  const { hits } = await this.es.search({
    index: 'mimir_sets',
    body: {
      query: { bool: { must, filter } },
      sort: [{ _score: 'desc' }, { likeCount: 'desc' }],
      from: (page - 1) * limit, size: limit,
      highlight: { fields: { title: {}, description: {} } },
    },
  });

  return {
    items: hits.hits.map(h => ({ ...h._source, highlights: h.highlight })),
    total: typeof hits.total === 'number' ? hits.total : hits.total.value,
  };
}
```

### 13.4 Index Synchronisation

The Study Service emits BullMQ events whenever a study set is created, updated, or deleted. The Search Service consumes these events and updates the Elasticsearch index asynchronously.

```typescript
// Event emitted by Study Service
this.eventEmitter.emit('set.updated', { setId, ownerId, title, visibility, ... });

// BullMQ job in Search Service
  @Process('sync-set')
  async processSyncSet(job: Job<SyncSetPayload>) {
    const { setId, action } = job.data;
    if (action === 'delete') {
      await this.es.delete({ index: 'mimir_sets', id: setId });
    } else {
      const set = await this.studyClient.getSet(setId);
      await this.es.index({ index: 'mimir_sets', id: setId, body: this.toDocument(set) });
    }
  }
```

---

## 14. Object Storage — Managed S3 / Cloudflare R2

Phase 1 uses **managed S3-compatible object storage**: Cloudflare R2 (preferred for zero-egress pricing) or AWS S3. The client SDK is `@aws-sdk/client-s3`, which speaks the same protocol to either provider — swapping is a config change. Local development uses a MinIO container as an S3 stand-in so no cloud credentials are needed to run the stack (see §3.5).

### 14.1 Bucket Structure

| Bucket | Access Policy | Contents | Path Pattern |
|---|---|---|---|
| `mimir-avatars` | Public read (or fronted by CDN) | User profile pictures (WebP, max 512×512px) | `/{userId}/avatar.webp` |
| `mimir-exports` | Private (presigned URL, 1h expiry) | Study set exports: CSV, PDF, Anki .apkg | `/{userId}/{exportId}/{filename}` |
| `mimir-set-versions` | Private | JSON snapshots for version history | `/{setId}/{versionId}.json` |

### 14.2 Storage Client Setup

The `StorageService` wraps `@aws-sdk/client-s3`. Configuration comes from env vars — the same code runs against R2, S3, or the local MinIO stand-in.

```typescript
// src/infrastructure/storage/storage.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly publicUrl: string;

  constructor(private config: ConfigService) {
    this.client = new S3Client({
      region: config.getOrThrow('S3_REGION'),                    // R2: 'auto'
      endpoint: config.get('S3_ENDPOINT'),                       // R2: https://<account>.r2.cloudflarestorage.com
      credentials: {
        accessKeyId: config.getOrThrow('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow('S3_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: config.get<boolean>('S3_FORCE_PATH_STYLE', false),  // true for MinIO dev
    });
    this.publicUrl = config.getOrThrow('S3_PUBLIC_URL');         // CDN URL for public buckets
  }

  async uploadBuffer(
    bucket: string, key: string, body: Buffer, contentType: string,
  ): Promise<string> {
    await this.client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: body, ContentType: contentType,
    }));
    return `${this.publicUrl}/${bucket}/${key}`;
  }

  async getPresignedUrl(bucket: string, key: string, expirySeconds = 3600): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: expirySeconds });
  }
}
```

### 14.3 Export Flow

When a user requests a set export, the `study` module enqueues a BullMQ job. A worker in the same process generates the file, uploads it to the `mimir-exports` bucket, and returns a presigned download URL valid for 1 hour.

*Export flow*

```
// Sequence:
// 1. GET /sets/:id/export?format=csv
// 2. StudyController validates auth, enqueues export job, returns 202 Accepted + jobId
// 3. BullMQ worker generates file (CSV/PDF/Anki)
// 4. Worker uploads to mimir-exports/{userId}/{jobId}/{filename}
// 5. Worker stores presigned URL in Redis: export:{jobId} = url (TTL: 1h)
// 6. Client polls GET /exports/:jobId/status
// 7. When status = "complete", response includes presigned download URL
```

---

## 15. Background Jobs — BullMQ

### 15.1 Queue Definitions

| Queue Name | Producer | Consumer Service | Purpose |
|---|---|---|---|
| email | Any service | Notification Service | Transactional emails (verification, assignment, weekly report) |
| push-notification | Any service | Notification Service | Firebase push notifications to iOS/Android/Web |
| srs-reminders | SRS Service (cron) | Notification Service | Daily "SRS queue ready" reminders at user-configured time |
| search-sync | Study Service | Search Service | Sync Elasticsearch index after set create/update/delete |
| set-export | Study Service | Study Service (worker) | Generate and upload CSV/PDF/Anki exports to MinIO |
| analytics-events | Any service | Analytics Service | Ingest learning events into ClickHouse |

### 15.2 Queue Configuration & Retry Policy

```typescript
import { Queue } from 'bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';

// Queue registration in module
BullModule.registerQueue(
  { name: 'email', defaultJobOptions: {
    attempts: 3, backoff: { type: 'exponential', delay: 5000 }
  }},
  { name: 'push-notification', defaultJobOptions: {
    attempts: 2, backoff: { type: 'fixed', delay: 2000 }
  }},
  { name: 'search-sync', defaultJobOptions: {
    attempts: 5, backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100, removeOnFail: 200
  }},
  { name: 'analytics-events', defaultJobOptions: {
    attempts: 3, backoff: { type: 'fixed', delay: 1000 },
    removeOnComplete: 50  // high throughput: don't retain completed jobs
  }},
),
```

### 15.3 SRS Cron Job

```typescript
// apps/services/srs/src/modules/srs/srs.scheduler.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SrsScheduler {
  constructor(@InjectQueue('srs-reminders') private queue: Queue) {}

  // Run at 06:00 UTC every day; enqueue individual reminders based on user timezone
  @Cron('0 6 * * *')
  async scheduleDailyReminders() {
    const usersWithQueue = await this.srsService.getUsersWithDueCards();
    for (const user of usersWithQueue) {
      const delay = this.computeDelay(user.timezone, user.reminderHour);
      await this.queue.add('send-srs-reminder', { userId: user.id }, { delay });
    }
  }

  private computeDelay(timezone: string, hourLocal: number): number {
    // Calculate ms until hourLocal in the user's timezone from now (UTC)
    const now = new Date();
    // ... timezone-aware calculation using Luxon or date-fns-tz
    return delayMs;
  }
}
```

---

## 16. Real-Time Features — Socket.io

### 16.1 Gateway Setup

```typescript
// apps/services/notification/src/gateways/events.gateway.ts
import { WebSocketGateway, WebSocketServer, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: { origin: process.env.WEB_APP_URL, credentials: true },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(private jwt: JwtService) {}

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth.token;
      const payload = this.jwt.verify(token);
      socket.data.userId = payload.sub;
      await socket.join(`user:${payload.sub}`);  // personal room
    } catch {
      socket.disconnect(true);  // reject unauthenticated connections
    }
  }
}
```

### 16.2 Event Types

| Event Name | Direction | Payload | Trigger |
|---|---|---|---|
| notification:new | Server → Client | { type, title, body, payload } | New notification inserted in DB |
| assignment:created | Server → Client | { assignmentId, classId, title, dueAt } | Teacher creates assignment |
| assignment:deadline-approaching | Server → Client | { assignmentId, hoursRemaining } | 24h before due date (BullMQ job) |

### 16.3 Emitting from Any Service

```typescript
// Notification Service exposes an internal endpoint that the gateway emits through
// Other services call this via the notification BullMQ queue:

await this.notificationQueue.add('push-socket', {
  userId: student.id,
  event: 'assignment:created',
  payload: { assignmentId, title, dueAt },
});

// In the notification worker:
  @Process('push-socket')
  async handleSocketPush(job: Job) {
    this.gateway.server
      .to(`user:${job.data.userId}`)
      .emit(job.data.event, job.data.payload);
  }
```

---

## 17. Security Implementation

### 17.1 Security Middleware Stack

```typescript
// Applied in main.ts for every service
import helmet from 'helmet';
import * as compression from 'compression';

app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: false,  // allow TTS audio from CDN
}));
app.use(compression());

// CORS — only allow registered origins
app.enableCors({
  origin: [process.env.WEB_APP_URL, process.env.MOBILE_APP_SCHEME].filter(Boolean),
  credentials: true,
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
});
```

### 17.2 API Rate Limiting (Throttler)

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

ThrottlerModule.forRoot([
  { name: 'short',  ttl: 1000,  limit: 10  },  // 10 req/sec burst protection
  { name: 'medium', ttl: 60000, limit: 200 },  // 200 req/min authenticated
]),

// Register as global guard in AppModule:
{ provide: APP_GUARD, useClass: ThrottlerGuard },

// Override per endpoint:
@Throttle({ medium: { ttl: 60000, limit: 5 } })  // tighter limit for login
@Post('/auth/login')
login() { ... }
```

### 17.3 Input Sanitisation

User-supplied text content (terms, definitions, comments) must be sanitised before storage to prevent XSS if the content is ever rendered as HTML.

```typescript
import * as DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window as unknown as Window;
const purify = DOMPurify(window);

// Use in the Cards service before saving:
const sanitised = purify.sanitize(dto.definition, {
  ALLOWED_TAGS: ['b','i','em','strong','br'],
  ALLOWED_ATTR: [],
});
```

### 17.4 Ownership Guard Pattern

Resources are protected by an ownership check in the service layer. A dedicated OwnershipGuard handles the pattern declaratively:

```typescript
// Usage:
@Patch(':id')
@UseGuards(JwtAuthGuard, OwnershipGuard)
@OwnershipResource({ entity: 'studySet', idParam: 'id', ownerField: 'ownerId' })
updateSet(@Param('id') id: string, @Body() dto: UpdateSetDto) { ... }

// OwnershipGuard resolves the entity and checks ownerId === request.user.id
// Throws 403 Forbidden if not the owner. Teachers with class context are handled
// by a separate TeacherContextGuard in the Classroom module.
```

### 17.5 Security Checklist

| Control | Implementation | Status |
|---|---|---|
| TLS 1.2+ in transit | Nginx terminates TLS; all internal service traffic on private K8s network | Required |
| AES-256 at rest | PostgreSQL volume encryption; MinIO SSE; Redis persistence encrypted | Required |
| Secrets management | HashiCorp Vault or Kubernetes Secrets (sealed with Sealed Secrets) | Required |
| SQL injection prevention | Prisma parameterised queries — no raw SQL with user input | Required |
| XSS prevention | DOMPurify on all user text input; React escape-by-default | Required |
| CSRF prevention | SameSite=Strict cookie + CORS origin whitelist | Required |
| Rate limiting | ThrottlerModule + Redis; per-endpoint overrides | Required |
| Dependency scanning | GitHub Dependabot + npm audit in CI pipeline | Required |
| OWASP Top 10 review | Manual review scheduled before Phase 1 launch | Required |

---

## 18. Testing Strategy

### 18.1 Testing Pyramid

| Level | Tool | Scope | Coverage Target |
|---|---|---|---|
| Unit | Jest | Service methods, algorithms (SM-2, evaluation), utilities | > 80% line coverage |
| Integration | Jest + Supertest | Controller → Service → Repository → Test DB (Docker PG) | > 70% of all API routes |
| E2E | Playwright | Critical user journeys in real browser against staging environment | 10 core flows |
| Contract | Pact (Phase 2) | Service-to-service API contracts | All cross-service calls |

### 18.2 Unit Test Example — SM-2 Algorithm

```typescript
// apps/services/srs/src/modules/srs/__tests__/sm2.service.spec.ts
import { Sm2Service } from '../sm2.service';

describe('Sm2Service', () => {
  let service: Sm2Service;

  beforeEach(() => { service = new Sm2Service(); });

  const baseCard = {
    easeFactor: 2.5, intervalDays: 1, repetitions: 0,
    lapses: 0, isLeech: false
  };

  it('again (0): resets interval to 1, increments lapses, reduces ease', () => {
    const card = { ...baseCard, repetitions: 3, intervalDays: 10, easeFactor: 2.5 };
    const result = service.processReview({ card: card as any, rating: 0, reviewedAt: new Date() });
    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.lapses).toBe(1);
    expect(Number(result.easeFactor)).toBeCloseTo(2.30, 2);
  });

  it('good (2): first repetition sets interval to 1', () => {
    const result = service.processReview({ card: baseCard as any, rating: 2, reviewedAt: new Date() });
    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it('is_leech becomes true after 7 lapses', () => {
    const card = { ...baseCard, lapses: 6 };
    const result = service.processReview({ card: card as any, rating: 0, reviewedAt: new Date() });
    expect(result.isLeech).toBe(true);
  });

  it('ease_factor minimum is 1.3', () => {
    const card = { ...baseCard, easeFactor: 1.31 };
    const result = service.processReview({ card: card as any, rating: 0, reviewedAt: new Date() });
    expect(Number(result.easeFactor)).toBeGreaterThanOrEqual(1.30);
  });
});
```

### 18.3 Integration Test Example — Sets Controller

```typescript
// apps/services/study/test/e2e/sets.e2e-spec.ts
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { UserFactory } from '@shared/testing';

describe('Sets (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    accessToken = await UserFactory.loginAndGetToken(app);
  });

  it('POST /sets — creates a set', async () => {
    const res = await request(app.getHttpServer())
      .post('/sets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Test Set', languageFrom: 'en', languageTo: 'fr' })
      .expect(201);

    expect(res.body.data.title).toBe('Test Set');
    expect(res.body.success).toBe(true);
  });

  it('GET /sets/:id — returns 403 for private set by other user', async () => {
    // ... create set as different user, attempt fetch as current user
  });

  afterAll(() => app.close());
});
```

### 18.4 Playwright E2E — Core User Flows

| Flow | Spec File | Steps Covered |
|---|---|---|
| User Registration & Login | auth.spec.ts | Register → verify email → login → access dashboard |
| Create Study Set & Add Cards | create-set.spec.ts | Create set → add 5 cards → edit one card → verify card count |
| Flashcards Study Mode | flashcards.spec.ts | Open set → start flashcards → flip 10 cards → complete session |
| AI Flashcard Generation | ai-generate.spec.ts | Enter topic → generate set → edit 2 cards → save to library |
| AI Fill-in-the-Blank Mode | ai-fill-blank.spec.ts | Select AI mode → answer 5 fill-blank questions → see result |
| AI Guess the Word Mode | ai-guess-word.spec.ts | Select AI mode → read clue → guess 5 words → request one hint |
| SRS Daily Review | srs-review.spec.ts | Open SRS queue → review 10 cards with all ratings → forecast updates |
| Teacher Creates Class & Assignment | classroom.spec.ts | Create class → copy join code → assign set → set due date |
| Student Joins & Completes Assignment | assignment.spec.ts | Join class → view assignment → complete study set → status shows complete |
| Search & Save a Public Set | search.spec.ts | Search for a term → filter by language → open set → save to library |

### 18.5 Test Configuration

```typescript
// packages/config/jest.base.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: { lines: 80, functions: 80, branches: 75 }
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.module.ts', '!src/main.ts'],
  moduleNameMapper: { '^@shared/(.*)$': '<rootDir>/../../shared/$1' },
  setupFilesAfterFramework: ['<rootDir>/../../packages/testing/src/setup.ts'],
};
export default config;
```

---

## 19. Deployment & Infrastructure

### 19.1 Local Development (Docker Compose)

Docker Compose brings up only the stateful dependencies. The NestJS app runs on the host via `pnpm start:dev` (fast HMR, easy debugger attach).

```yaml
# mimir-backend/infra/docker-compose.yml
version: "3.9"
services:

  postgres:
    image: postgres:16-alpine
    environment: { POSTGRES_DB: mimir, POSTGRES_USER: mimir, POSTGRES_PASSWORD: mimir }
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.13.0
    environment: { "discovery.type": "single-node", "xpack.security.enabled": "false" }
    ports: ["9200:9200"]

  # Local S3 stand-in — production uses managed S3 or Cloudflare R2 (see §14)
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment: { MINIO_ROOT_USER: minioadmin, MINIO_ROOT_PASSWORD: minioadmin }
    ports: ["9000:9000", "9001:9001"]
    volumes: [miniodata:/data]

volumes: { pgdata: {}, miniodata: {} }
```

> ClickHouse is removed — analytics uses PostgreSQL + TimescaleDB (§2.2.6). The Timescale extension is enabled via a Prisma migration; no separate container is needed.

### 19.2 Dockerfile — Single App

The whole backend is one image. Multi-stage build; final image runs the NestJS app on Node 20.

```dockerfile
# mimir-backend/infra/Dockerfile

## Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

## Stage 2: Build TypeScript + generate Prisma client
FROM deps AS build
COPY . .
RUN pnpm prisma generate
RUN pnpm build

## Stage 3: Production image — minimal footprint
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist                    ./dist
COPY --from=build /app/node_modules/.prisma    ./node_modules/.prisma
COPY --from=build /app/prisma                  ./prisma
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 19.3 Fly.io Deployment Config

Primary hosting target is **Fly.io** — one config file, one command to deploy. The platform handles TLS, rolling deploys, health checks, and autoscaling. Replace with Railway / Render / ECS config if that platform is chosen instead; the app itself is portable.

```toml
# mimir-backend/infra/fly.toml
app = "mimir"
primary_region = "fra"           # Frankfurt — EU baseline; add more regions in Phase 2

[build]
dockerfile = "infra/Dockerfile"

[env]
NODE_ENV = "production"
PORT = "3000"

[[services]]
protocol = "tcp"
internal_port = 3000

  [[services.ports]]
  handlers = ["http"]
  port = 80
  force_https = true

  [[services.ports]]
  handlers = ["tls", "http"]
  port = 443

  [services.concurrency]
  type = "requests"
  hard_limit = 250
  soft_limit = 200

  [[services.http_checks]]
  interval = "10s"
  timeout = "2s"
  method = "get"
  path = "/health"

  [[services.http_checks]]
  interval = "10s"
  timeout = "2s"
  method = "get"
  path = "/health/ready"

# Autoscaling: min 2 (for HA), max 10 in Phase 1
[[vm]]
size = "shared-cpu-2x"
memory = "1gb"
min_machines_running = 2
```

Managed dependencies (Postgres, Redis, Elasticsearch, S3/R2) are provisioned once and referenced by their production URLs in Fly secrets:

```bash
fly secrets set \
  DATABASE_URL="postgresql://…" \
  REDIS_URL="rediss://…" \
  ELASTICSEARCH_URL="https://…" \
  S3_ENDPOINT="https://…" S3_ACCESS_KEY_ID="…" S3_SECRET_ACCESS_KEY="…" \
  JWT_PRIVATE_KEY="$(cat jwt-private.pem)" JWT_PUBLIC_KEY="$(cat jwt-public.pem)" \
  ANTHROPIC_API_KEY="sk-ant-…" \
  SENDGRID_API_KEY="SG.…" \
  FCM_SERVER_KEY="AAAA…" \
  GOOGLE_CLIENT_ID="…" GOOGLE_CLIENT_SECRET="…"
```

### 19.4 CI/CD Pipelines — Two Repositories

There are two independent pipelines: one for the backend monolith, one for the frontend monorepo.

#### 19.4.1 mimir-backend CI/CD

```yaml
# mimir-backend/.github/workflows/ci.yml
name: Backend CI
on:
  push: { branches: [main, develop] }
  pull_request: { branches: [main] }

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16-alpine, env: { POSTGRES_PASSWORD: test }, ports: ["5432:5432"] }
      redis:    { image: redis:7-alpine, ports: ["6379:6379"] }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm lint
      - run: pnpm test -- --coverage
      - run: pnpm test:e2e

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

#### 19.4.2 mimir-app CI/CD (Web + Mobile)

Turborepo runs lint/test/build in parallel across `apps/web`, `apps/mobile`, and every `packages/*`. Web deploys to a CDN on green main; mobile deploys via Expo EAS.

```yaml
# mimir-app/.github/workflows/ci.yml
name: App CI
on:
  push: { branches: [main, develop] }
  pull_request: { branches: [main] }

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      # Regenerate API types from staging backend spec, then verify no drift
      - name: Generate API types
        run: BACKEND_STAGING_URL=${{ vars.BACKEND_STAGING_URL }} bash scripts/generate-api-types.sh
      - run: git diff --exit-code packages/api-client/src/generated

      - run: pnpm turbo lint type-check test build

  deploy-web:
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web build
      # Deploy to Cloudflare Pages (or S3+CloudFront / Vercel static)
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy apps/web/dist --project-name=mimir-web

  deploy-mobile:
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - uses: expo/expo-github-action@v8
        with:
          token: ${{ secrets.EXPO_TOKEN }}
      - run: cd apps/mobile && eas build --platform all --non-interactive --auto-submit
```

### 19.5 Environment Variables Reference

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Fly Postgres / RDS / Supabase). Use `?pgbouncer=true` if fronted by PgBouncer. |
| `REDIS_URL` | Redis connection URL (Upstash / Fly Redis / ElastiCache). |
| `ELASTICSEARCH_URL` | Managed Elasticsearch or OpenSearch endpoint. |
| `JWT_PRIVATE_KEY` | RS256 private key for signing JWTs. |
| `JWT_PUBLIC_KEY` | RS256 public key for verifying JWTs. |
| `S3_ENDPOINT` | S3-compatible endpoint. Empty for AWS S3; set for R2 / MinIO. |
| `S3_REGION` | `auto` for R2; region name for S3. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Object storage credentials. |
| `S3_PUBLIC_URL` | CDN URL fronting public buckets (avatars). |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials. |
| `APPLE_OAUTH_TEAM_ID` / `APPLE_OAUTH_KEY_ID` / `APPLE_OAUTH_PRIVATE_KEY` | Apple OAuth credentials. |
| `SENDGRID_API_KEY` | Transactional email API key. |
| `FCM_SERVICE_ACCOUNT_JSON` | Firebase service account (base64 JSON) for FCM push. |
| `GOOGLE_TTS_API_KEY` or `ELEVENLABS_API_KEY` | TTS provider credentials *(post-MVP — required when §10 ships in v1.1; do not provision for v1.0)*. |

---

## 20. Performance & Scalability

### 20.1 Query Optimisation

| Query | Optimisation | Implementation |
|---|---|---|
| SRS daily queue (most frequent) | Composite index on (userId, dueDate); pre-computed cached result in Redis per user per day. | index idx_srs_due on srs_cards(user_id, due_date); Redis cache with 24h TTL. |
| Public set discovery | Elasticsearch — avoids full-table scan on PostgreSQL for text search. | Dedicated search index; PostgreSQL only used as source of truth. |
| Card list for a set | Ordered by position with covering index; no N+1 with Prisma include. | index on (set_id, position); single Prisma query with nested include. |
| Class assignment list | Index on (classId, dueAt); paginated; teacher's own view cached for 60s. | Composite index; Redis cache keyed by classId. |
| Leaderboard (Phase 2) | Redis Sorted Set — O(log N) ZADD and ZRANGE operations. | Redis ZSet updated on XP award; persisted to PostgreSQL nightly. |

### 20.2 Horizontal Scaling

Every NestJS service is stateless — session state is stored in Redis, not in memory. This allows each service to be scaled horizontally by increasing replica count in Kubernetes. Kubernetes HPA (Horizontal Pod Autoscaler) is configured for the Learning and Study services (highest expected load):

```yaml
# HPA for Study Service
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: mimir-study-hpa }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: mimir-study }
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 65 } }
    - type: Resource
      resource: { name: memory, target: { type: Utilization, averageUtilization: 75 } }
  behavior:
    scaleDown: { stabilizationWindowSeconds: 120 }  # avoid flapping
```

### 20.3 Database Connection Pooling

Each service instance maintains a small Prisma connection pool. PgBouncer runs as a deployment sidecar to multiplex connections and prevent PostgreSQL hitting its connection limit under scale.

| Component | Configuration | Rationale |
|---|---|---|
| Prisma pool size per instance | connection_limit=5 (via DATABASE_URL param) | Low per-instance pool since PgBouncer multiplexes. |
| PgBouncer mode | transaction pooling | Scales to many more clients than session pooling. |
| PostgreSQL max_connections | 200 | Sufficient with PgBouncer in front; avoid memory pressure. |
| Read replicas | 1 replica per high-traffic service (Study, Learning) | Distribute read load; writes still go to primary. |

### 20.4 AI Response Streaming

The AI Flashcard Generation endpoint streams the Claude API response to reduce perceived latency. The client receives a text/event-stream response and renders cards progressively as they arrive.

```typescript
// AI Service — streaming endpoint
@Sse('generate/flashcards/stream')
@UseGuards(JwtAuthGuard)
streamFlashcards(@Body() dto: GenerateFlashcardsDto, @Res() res: Response) {
  const stream = this.anthropic.client.messages.stream({
    model: this.anthropic.model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildPrompt(dto) }],
  });

  stream.on('text', (text) => {
    res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
  });

  stream.on('finalMessage', () => {
    res.write('data: [DONE]\n\n');
    res.end();
  });
}
```

---

## 21. Error Handling & Logging

### 21.1 Structured Logging

All services use Pino (via nestjs-pino) for structured JSON logging. Logs are written to stdout, collected by the Kubernetes node log agent (Promtail), and shipped to Loki for centralised querying in Grafana.

```typescript
// app.module.ts — Pino logger integration
import { LoggerModule } from 'nestjs-pino';

LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
    serializers: { req: (req) => ({ method: req.method, url: req.url }) },
    customProps: (req) => ({
      requestId: req.headers['x-request-id'],
      userId: req.user?.id,
    }),
  },
}),
```

### 21.2 Standard Log Levels & Usage

| Level | When to Use | Example |
|---|---|---|
| error | Unhandled exceptions, failed third-party calls, data integrity issues. | AI API call failed after 3 retries; request_id=abc, userId=xyz |
| warn | Degraded state that's handled: cache miss under high load, rate limit approaching. | SRS queue cache miss for userId; falling back to DB query |
| info | Business events: user registered, set created, assignment completed. | Assignment completed; assignmentId=abc, studentId=xyz, masteryPct=87 |
| debug | Detailed execution flow for debugging (disabled in production). | SM-2 calculation: input={easeFactor:2.5, rating:2}, output={interval:6} |
| http | Request/response pairs (logged by Pino HTTP). | GET /sets/abc 200 45ms |

### 21.3 Error Classification

| Error Category | Handling | Client Response |
|---|---|---|
| Validation errors (class-validator) | ValidationPipe throws BadRequestException automatically. | 400 VALIDATION_ERROR with field-level details |
| Resource not found | Service throws NotFoundException('Set not found'). | 404 NOT_FOUND |
| Unauthorised access | JwtAuthGuard throws UnauthorizedException. | 401 UNAUTHORIZED |
| Forbidden (ownership) | OwnershipGuard throws ForbiddenException. | 403 FORBIDDEN |
| Business rule violation | Service throws UnprocessableEntityException. | 422 UNPROCESSABLE with descriptive message |
| External service failure (AI, TTS) | Caught in service; fallback applied or ServiceUnavailableException thrown. | 503 SERVICE_UNAVAILABLE with retry guidance |
| Unhandled exception | GlobalExceptionFilter catches all; logs at error level; returns 500. | 500 INTERNAL_ERROR (no stack trace to client in production) |

### 21.4 Health Check Endpoints

```typescript
// health/health.controller.ts
import { HealthCheckService, PrismaHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';

@Get('health')
healthCheck() {
  return this.health.check([
    () => this.prisma.pingCheck('database'),
    () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),  // 300 MB max
  ]);
}

// Separate readiness probe: ensures DB migrations have completed
@Get('health/ready')
readiness() {
  return this.health.check([
    () => this.prisma.pingCheck('database'),
  ]);
}

// Kubernetes liveness probe hits /health
// Kubernetes readiness probe hits /health/ready
// A pod is only sent traffic once /health/ready returns 200
```

### 21.5 Distributed Tracing

OpenTelemetry is instrumented in each service. Traces are exported to a local Jaeger or Tempo instance. Each incoming request creates a root span; all downstream calls (DB, Redis, AI API, BullMQ jobs) are auto-instrumented child spans. The requestId from the X-Request-ID header is propagated through all spans for correlation.

```typescript
// Instrumentation bootstrap (called before NestFactory.create):
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
  instrumentations: [
    new PrismaInstrumentation(),
    // auto-instruments: http, redis, express (nest uses express adapter)
  ],
});
sdk.start();
```

---

*© 2026 Mimir. Internal Engineering Use Only.*
