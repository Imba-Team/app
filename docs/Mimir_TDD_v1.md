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
- [4. Backend Architecture — NestJS Services](#4-backend-architecture-nestjs-services)
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
- [14. Object Storage — MinIO](#14-object-storage-minio)
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
| API Framework | NestJS | v10.x | Opinionated Node.js framework with native DI, decorators, modules, and first-class TypeScript support. Eliminates boilerplate, enforces structure, and has mature ecosystem. |
| Runtime | Node.js | v20 LTS | LTS release; stable V8; native ESM + CJS compatibility. |
| Language | TypeScript | v5.x | Strict typing throughout. Each repository maintains its own tsconfig. Frontend types are generated from the backend OpenAPI spec. |
| ORM | Prisma | v5.x | Type-safe database client with auto-generated types from schema. Superior developer experience over TypeORM for new projects. Migrations are explicit SQL. |
| Primary Database | PostgreSQL | v16 | ACID-compliant relational DB. JSON/JSONB support for flexible fields. Full-text search as fallback. Well-supported by Prisma. |
| Cache / Queue | Redis | v7 | Session storage, rate-limit counters, BullMQ job queues, SRS due-date cache, leaderboard sorted sets. |
| Search Engine | Elasticsearch | v8.x | Full-text search with language-aware tokenisation, autocomplete (edge n-gram), and relevance scoring. |
| Analytics DB | ClickHouse | v24.x | Columnar storage optimised for high-throughput append and fast aggregation queries over event data. |
| Object Storage | MinIO | Latest | Self-hosted S3-compatible API. Stores exported files (CSV, PDF, Anki), user avatars. No cloud vendor lock-in. |
| Frontend Framework | React | v18 | Component model, concurrent rendering, and React Query for server state. Industry-standard for web SPAs. |
| Frontend Build | Vite | v5.x | Sub-second HMR, ES module-native, superior DX over Webpack/CRA. |
| Frontend State | Zustand + TanStack Query | Latest | Zustand: minimal global state (auth, UI). TanStack Query: server state, caching, background refetch. |
| UI Components | Radix UI + Tailwind CSS | Latest | Radix: unstyled, accessible primitives. Tailwind: utility-first, purged in production. |
| Real-time | Socket.io | v4.x | WebSocket with fallback transports. NestJS gateway adapter available out of the box. |
| Background Jobs | BullMQ | v5.x | Redis-backed job queues. Retry logic, rate limiting, priority queues, cron scheduling built in. |
| Email | SendGrid | Latest API | Transactional email with template support, delivery tracking, and bounce handling. |
| Push Notifications | Firebase Cloud Messaging | v9 | Cross-platform push (iOS, Android, Web) via a single unified API. |
| Auth | Passport.js + @nestjs/jwt | Latest | Strategy-based auth in NestJS. JWT local + OAuth Google strategies. |
| Validation | class-validator + class-transformer | Latest | Declarative DTO validation via decorators. Used in NestJS ValidationPipe. |
| Container | Docker | v26 | Multi-stage Dockerfiles for minimal production images. |
| Orchestration | Kubernetes | v1.29+ | Pod autoscaling, rolling deployments, health probes, config/secret management. |
| CI/CD | GitHub Actions | — | Three separate pipeline files: one per repository (backend, web, mobile). Docker images pushed to GitHub Container Registry (ghcr.io). |
| API Contract | OpenAPI 3.0 + openapi-typescript | — | Backend publishes Swagger spec at /api/docs-json. Frontend repo generates TypeScript API types from it during CI. |
| Observability | Prometheus + Grafana + Loki | — | Metrics scraping, dashboards, and log aggregation. OpenTelemetry for distributed tracing. |
| API Docs | Swagger / OpenAPI | v3.0 | Auto-generated via @nestjs/swagger decorators. Served at /api/docs. |

### 2.2 Key Technology Decisions

#### 2.2.1 NestJS over Express/Fastify Directly

NestJS is chosen as the backend framework for all services. While Fastify would offer marginally higher raw throughput, NestJS provides critical structural benefits:

- Built-in Dependency Injection container eliminates manual wiring.
- Decorator-based Controllers, Guards, Pipes, and Interceptors are self-documenting.
- @nestjs/swagger auto-generates OpenAPI documentation from DTOs and decorators.
- Native WebSocket gateway support via @nestjs/platform-socket.io.
- First-class testing utilities (NestJS Testing module).
- Fastify adapter is available as a drop-in replacement if throughput benchmarks demand it.

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

---

## 3. Repository & Project Structure

### 3.1 Repository Overview

Mimir uses three independent Git repositories. There is no monorepo tooling. Each repository is self-contained with its own dependency manifest, CI/CD pipeline, and deployment lifecycle.

| Repository | Contents | Primary Language | Deployed As |
|---|---|---|---|
| mimir-backend | All NestJS microservices, Prisma schema, shared backend utilities, infrastructure config. | TypeScript (Node.js) | Docker containers on Kubernetes |
| mimir-web | React SPA web application. | TypeScript (React + Vite) | Static build deployed to CDN / Nginx |
| mimir-mobile | iOS (Swift/SwiftUI) and Android (Kotlin/Compose) native apps. | Swift + Kotlin | App Store + Google Play |

> **Rationale for Separate Repositories**
>
> Frontend, backend, and mobile have independent release cadences, different teams, different toolchains, and very different deployment mechanisms. A monorepo would couple these unnecessarily. The API contract between repos is maintained via the OpenAPI specification published by the backend (see Section 3.5).

### 3.2 mimir-backend Repository

All nine NestJS microservices live in a single backend repository. They share a Prisma schema and internal utilities via a local shared/ directory, but each service has its own package.json, Dockerfile, and build pipeline. There is no workspace manager — services reference shared code via relative paths.

*mimir-backend directory layout*

```
mimir-backend/
├── services/                       # One directory per NestJS service
│   ├── auth/                       # Auth Service
│   │   ├── src/
│   │   ├── test/
│   │   ├── Dockerfile
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── study/                      # Study Service
│   ├── learning/                   # Learning Service
│   ├── srs/                        # SRS Service
│   ├── ai/                         # AI Service
│   ├── classroom/                  # Classroom Service
│   ├── search/                     # Search Service
│   ├── notification/               # Notification Service
│   └── analytics/                  # Analytics Service
├── shared/                         # Internal shared code (not published)
│   ├── types/                      # TypeScript enums & interfaces
│   │   ├── user-role.enum.ts
│   │   ├── visibility.enum.ts
│   │   └── index.ts
│   ├── prisma/                     # Single Prisma schema for all services
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── generated/              # PrismaClient output (gitignored)
│   └── testing/                    # Shared test factories and mocks
│       ├── user.factory.ts
│       ├── set.factory.ts
│       └── prisma-test-client.ts
├── infra/
│   ├── docker-compose.yml          # Full local dev stack
│   └── k8s/                        # Helm charts for all services
│       ├── auth/
│       ├── study/
│       └── ...
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Test + lint all changed services
│       └── deploy.yml              # Build + push + deploy on main merge
├── tsconfig.base.json              # Base TS config extended by each service
└── .env.example                    # Template for local environment variables
```

#### 3.2.1 NestJS Service Internal Structure

Every service in services/ follows this identical internal layout:

*NestJS service internal structure*

```
services/study/                     # Example: Study Service
├── src/
│   ├── main.ts                     # Bootstrap: NestFactory, global pipes, swagger
│   ├── app.module.ts               # Root module
│   ├── config/
│   │   └── configuration.ts        # ConfigModule setup + Joi env validation
│   ├── modules/
│   │   ├── sets/                   # Feature: Study Sets
│   │   │   ├── sets.module.ts
│   │   │   ├── sets.controller.ts
│   │   │   ├── sets.service.ts
│   │   │   ├── sets.repository.ts  # Thin Prisma wrapper
│   │   │   ├── dto/
│   │   │   │   ├── create-set.dto.ts
│   │   │   │   └── update-set.dto.ts
│   │   │   └── __tests__/
│   │   ├── cards/
│   │   ├── folders/
│   │   └── versions/
│   ├── common/
│   │   ├── guards/
│   │   ├── decorators/
│   │   ├── filters/
│   │   └── interceptors/
│   └── health/
│       └── health.controller.ts
├── test/e2e/
├── Dockerfile
├── tsconfig.json                   # extends ../../tsconfig.base.json
└── package.json
```

#### 3.2.2 Shared Code Access Pattern

Services reference shared/ via relative TypeScript path aliases defined in tsconfig.json. There is no npm publish step — the shared code is imported directly at build time.

```typescript
// services/study/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/types":   ["../../shared/types/index.ts"],
      "@shared/prisma":  ["../../shared/prisma/generated/client"],
      "@shared/testing": ["../../shared/testing/index.ts"]
    }
  }
}

// Usage inside any service:
import { UserRole, Visibility } from '@shared/types';
import { PrismaClient } from '@shared/prisma';
```

### 3.3 mimir-web Repository

*mimir-web directory layout*

```
mimir-web/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   ├── features/
│   │   ├── auth/
│   │   ├── sets/
│   │   ├── study/
│   │   │   └── modes/
│   │   ├── srs/
│   │   ├── classroom/
│   │   ├── ai/
│   │   └── analytics/
│   ├── components/ui/
│   ├── hooks/
│   ├── store/
│   ├── api/
│   │   ├── client.ts               # axios instance with JWT interceptor
│   │   ├── generated/              # AUTO-GENERATED — do not edit manually
│   │   │   └── api-types.ts        # Types from backend OpenAPI spec
│   │   ├── sets.api.ts             # TanStack Query hooks
│   │   ├── learning.api.ts
│   │   └── ...
│   └── lib/
├── scripts/
│   └── generate-api-types.sh       # Fetches OpenAPI spec; runs openapi-typescript
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint, type-check, test, build
│       └── deploy.yml              # Build + deploy to CDN on main merge
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### 3.4 mimir-mobile Repository

*mimir-mobile directory layout*

```
mimir-mobile/
├── ios/                            # iOS — Swift 5 + SwiftUI
│   ├── Mimir.xcodeproj/
│   └── Mimir/
│       ├── App/
│       │   └── MimirApp.swift
│       ├── Features/
│       │   ├── Auth/
│       │   ├── Study/
│       │   ├── SRS/
│       │   └── Classroom/
│       ├── Networking/
│       │   ├── APIClient.swift
│       │   └── Models/             # Hand-written or OpenAPI-generated Swift models
│       └── Resources/
├── android/                        # Android — Kotlin + Jetpack Compose
│   └── app/
│       └── src/main/
│           ├── java/com/mimir/
│           │   ├── ui/             # Compose screens
│           │   ├── data/           # Repository pattern + Retrofit
│           │   └── domain/
│           └── res/
└── .github/
    └── workflows/
        ├── ios-ci.yml              # Xcode build + test + TestFlight deploy
        └── android-ci.yml          # Gradle build + test + Play Console deploy
```

### 3.5 Cross-Repository API Contract

Since frontend and backend live in separate repos, types cannot be shared via import paths. The contract is maintained through the OpenAPI specification automatically published by the backend.

| Step | Tool | Who Runs It | When |
|---|---|---|---|
| 1. Backend generates OpenAPI spec | @nestjs/swagger auto-generates spec from DTO decorators | Automatic on every NestJS start | Every backend deployment |
| 2. Spec published at /api/docs-json | NestJS Swagger endpoint (JSON format) | Automatic | Always available on staging |
| 3. Web repo generates TS types | openapi-typescript CLI (in scripts/generate-api-types.sh) | Frontend developer or CI pipeline | Before each frontend release |
| 4. iOS/Android generate API models | OpenAPI Generator (Swift5 / kotlin targets) or hand-written | Mobile developer | Before each mobile release |

```bash
# scripts/generate-api-types.sh (in mimir-web)
#!/bin/bash
set -e

SPEC_URL="${BACKEND_STAGING_URL}/api/docs-json"
OUT="src/api/generated/api-types.ts"

echo "Fetching OpenAPI spec from $SPEC_URL..."
npx openapi-typescript "$SPEC_URL" --output "$OUT"
echo "Types generated at $OUT"

# Run this manually: pnpm run generate:types
# Or automatically in CI before the type-check step
```

### 3.6 Local Development Across Repos

Developers working on a full-stack feature run the backend and frontend in separate terminals. The backend repo's docker-compose.yml brings up all infrastructure dependencies (PostgreSQL, Redis, Elasticsearch, MinIO, ClickHouse). Backend services are started individually.

```bash
# Terminal 1 — start infrastructure (in mimir-backend)
docker compose up -d postgres redis elasticsearch minio clickhouse

# Terminal 2 — run Prisma migrations and start the study service
cd services/study
npx prisma migrate dev
npm run start:dev

# Terminal 3 — start the auth service
cd services/auth
npm run start:dev

# Terminal 4 — start the web app (in mimir-web)
# .env.local points VITE_API_BASE_URL to http://localhost:3001 (auth) etc.
npm run dev
```

> **Environment Variables for Local Development**
>
> Each service in mimir-backend has a .env file (gitignored) and a .env.example (committed). The mimir-web repo has a .env.local (gitignored) pointing to local backend service ports. The .env.example files in both repos document every required variable. No cross-repo env sharing is needed.

---

## 4. Backend Architecture — NestJS Services

### 4.1 Service Bootstrap Pattern

Every service bootstraps identically. The main.ts sets up global middleware, validation, and Swagger:

```typescript
// services/study/src/main.ts  (within mimir-backend repo)
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Global validation — strip unknown props, transform payloads to DTO class instances
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // URI versioning: /v1/sets, /v2/sets
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Mimir Study Service API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

### 4.2 Root App Module Pattern

```typescript
// services/study/src/app.module.ts  (within mimir-backend repo)
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { SetsModule } from './modules/sets/sets.module';
import { CardsModule } from './modules/cards/cards.module';
import { FoldersModule } from './modules/folders/folders.module';
import { HealthModule } from './health/health.module';
import configuration from './config/configuration';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,         // Joi schema — throws on startup if env is invalid
    }),
    PrismaModule,       // Global Prisma client
    SetsModule,
    CardsModule,
    FoldersModule,
    HealthModule,
  ],
})
export class AppModule {}
```

### 4.3 Service-to-Service Communication

Services communicate via HTTP REST in Phase 1. Synchronous calls use the NestJS HttpModule (axios wrapper). Asynchronous events are published to BullMQ (Redis-backed). A shared service map defines base URLs from environment variables.

| Communication Type | Mechanism | Use Case |
|---|---|---|
| Synchronous Request | HttpModule (axios) | Learning Service calls SRS Service to update a card after a study answer. |
| Async Fire-and-Forget | BullMQ (Redis queue) | Learning Service emits "session.completed" event; Analytics Service consumes it. |
| Real-time Push | Socket.io (WebSocket) | Gateway service pushes live notifications to connected clients. |
| Scheduled Work | BullMQ Cron | SRS Service runs nightly to advance due dates and send SRS reminder push via Notification Service. |

### 4.4 Feature Module Pattern

All feature modules follow the same pattern: Module → Controller → Service → Repository. The repository is a thin Prisma wrapper; all business logic lives in the Service.

```typescript
// modules/sets/sets.module.ts
import { Module } from '@nestjs/common';
import { SetsController } from './sets.controller';
import { SetsService } from './sets.service';
import { SetsRepository } from './sets.repository';

@Module({
  controllers: [SetsController],
  providers: [SetsService, SetsRepository],
  exports: [SetsService],   // exported so other modules can inject it
})
export class SetsModule {}

// modules/sets/sets.repository.ts — thin Prisma wrapper
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/prisma';
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

### 4.5 Inter-Service API Contracts

Each service exposes a typed client package (e.g., @mimir/study-client) generated from its OpenAPI spec. Other services import and use the typed client — never raw HTTP strings.

| Service | Internal Port | Responsibilities | Calls To |
|---|---|---|---|
| auth | 3001 | JWT issuance, OAuth, user CRUD | (none) |
| study | 3002 | Sets, cards, folders, versions, import/export | auth (JWT verify), search (index sync), analytics (events) |
| learning | 3003 | Session state, mode logic, progress | study (card reads), srs (update review), ai (AI modes), analytics (events) |
| srs | 3004 | SM-2 scheduling, queue, forecast | (none — event-driven update from learning) |
| ai | 3005 | Claude API integration, prompt management | (none — called by learning) |
| classroom | 3006 | Classes, assignments, results | auth (role check), study (set read), notification (send) |
| search | 3007 | Elasticsearch index management, autocomplete | (none — receives events from study service) |
| notification | 3008 | Push, email, job scheduling | (none — receives jobs from BullMQ queues) |
| analytics | 3009 | Event ingestion, aggregation, dashboard APIs | (none — receives events from BullMQ) |

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
  | 'WRITE'
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
  WRITE: 1.0,
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
| Recall weight | 1.0 | Code constant | Write / Learn-written / Test-written / both AI modes. |
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

> **⚠ Deferred to post-MVP (v1.1).** No TTS code ships in v1.0. The design below is preserved as the intended implementation for when the feature is re-scoped — do not build against it during MVP sprints. See the roadmap Post-MVP scope table for the v1.1 slot.

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
| Max calls / 30-min window | 200 | Covers a typical Flashcard Mode session |
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

## 14. Object Storage — MinIO

### 14.1 Bucket Structure

| Bucket | Access Policy | Contents | Path Pattern |
|---|---|---|---|
| mimir-avatars | Public read | User profile pictures (WebP, max 512×512px) | /{userId}/avatar.webp |
| mimir-exports | Private (presigned URL) | Study set exports: CSV, PDF, Anki .apkg | /{userId}/{exportId}/{filename} |
| mimir-set-versions | Private | JSON snapshots for version history | /{setId}/{versionId}.json |

### 14.2 MinIO Client Setup

```typescript
import * as Minio from 'minio';

@Injectable()
export class MinioService {
  private readonly client: Minio.Client;

  constructor(private config: ConfigService) {
    this.client = new Minio.Client({
      endPoint: config.getOrThrow('MINIO_ENDPOINT'),
      port: config.get('MINIO_PORT', 9000),
      useSSL: config.get('MINIO_USE_SSL', false),
      accessKey: config.getOrThrow('MINIO_ACCESS_KEY'),
      secretKey: config.getOrThrow('MINIO_SECRET_KEY'),
    });
  }

  async uploadBuffer(bucket: string, key: string,
    buffer: Buffer, contentType: string): Promise<string> {
    await this.client.putObject(bucket, key, buffer, buffer.length,
      { 'Content-Type': contentType });
    return `${this.config.get('MINIO_PUBLIC_URL')}/${bucket}/${key}`;
  }

  async getPresignedUrl(bucket: string, key: string,
    expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(bucket, key, expirySeconds);
  }
}
```

### 14.3 Export Flow

When a user requests a set export, a BullMQ job is enqueued. The job runs in the Study Service background worker, generates the file, uploads to MinIO, and returns a presigned download URL valid for 1 hour.

*Export flow*

```
// Sequence:
// 1. GET /sets/:id/export?format=csv
// 2. Study Service validates auth, enqueues export job, returns 202 Accepted + jobId
// 3. Background worker generates file (CSV/PDF/Anki)
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

```yaml
# infra/docker-compose.yml — full local stack
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

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment: { MINIO_ROOT_USER: minioadmin, MINIO_ROOT_PASSWORD: minioadmin }
    ports: ["9000:9000", "9001:9001"]
    volumes: [miniodata:/data]

  clickhouse:
    image: clickhouse/clickhouse-server:24-alpine
    ports: ["8123:8123", "9999:9000"]

volumes: { pgdata: {}, miniodata: {} }
```

### 19.2 Dockerfile — NestJS Service

Each service in mimir-backend has its own Dockerfile at services/<name>/Dockerfile. Because there is no workspace manager, the build copies only what the service needs plus the shared/ directory.

```dockerfile
# services/study/Dockerfile

## Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
# Copy service manifest
COPY services/study/package*.json ./services/study/
# Copy shared code that the service imports at build time
COPY shared/ ./shared/
RUN cd services/study && npm ci --omit=dev

## Stage 2: Build TypeScript
FROM deps AS build
COPY services/study/ ./services/study/
COPY tsconfig.base.json ./
RUN cd services/study && npm run build

## Stage 3: Production image — minimal footprint
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/study/dist        ./dist
COPY --from=build /app/services/study/node_modules ./node_modules
COPY --from=build /app/shared/prisma/generated    ./shared/prisma/generated
USER node
EXPOSE 3002
CMD ["node", "dist/main.js"]
```

### 19.3 Kubernetes Deployment Manifest

```yaml
# infra/k8s/services/study/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mimir-study
  namespace: mimir
spec:
  replicas: 2
  selector:
    matchLabels: { app: mimir-study }
  template:
    metadata:
      labels: { app: mimir-study }
    spec:
      containers:
        - name: study
          image: ghcr.io/mimir/study:{{ .Values.image.tag }}
          ports: [{ containerPort: 3002 }]
          envFrom:
            - secretRef: { name: mimir-study-secrets }
            - configMapRef: { name: mimir-common-config }
          livenessProbe:
            httpGet: { path: /health, port: 3002 }
            initialDelaySeconds: 15
          readinessProbe:
            httpGet: { path: /health/ready, port: 3002 }
            initialDelaySeconds: 5
          resources:
            requests: { memory: "256Mi", cpu: "100m" }
            limits:   { memory: "512Mi", cpu: "500m" }
```

### 19.4 CI/CD Pipelines — Three Separate Repositories

Each repository has its own independent CI/CD pipeline. There is no cross-repo build dependency — the only integration point is the OpenAPI spec URL used by mimir-web for type generation.

#### 19.4.1 mimir-backend CI Pipeline

Triggered on push to any branch. Runs for all services in parallel, using a matrix strategy keyed by the changed service directory.

```yaml
# mimir-backend/.github/workflows/ci.yml
name: Backend CI
on:
  push: { branches: [main, develop] }
  pull_request: { branches: [main] }

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.changes.outputs.services }}
    steps:
      - uses: actions/checkout@v4
      - id: changes
        run: |
          # Detect which services/ subdirs changed vs main
          CHANGED=$(git diff --name-only origin/main | grep "^services/" | cut -d/ -f2 | sort -u | jq -Rcs 'split("\n")[:-1]')
          echo "services=$CHANGED" >> $GITHUB_OUTPUT

  test:
    needs: detect-changes
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: ${{ fromJson(needs.detect-changes.outputs.services) }}
    services:
      postgres: { image: postgres:16-alpine, env: { POSTGRES_PASSWORD: test }, ports: ["5432:5432"] }
      redis:    { image: redis:7-alpine, ports: ["6379:6379"] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: cd services/${{ matrix.service }} && npm ci
      - run: cd services/${{ matrix.service }} && npm run lint
      - run: cd services/${{ matrix.service }} && npm test -- --coverage

  build-and-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    strategy:
      matrix:
        service: ${{ fromJson(needs.detect-changes.outputs.services) }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
      - run: |
          docker build -f services/${{ matrix.service }}/Dockerfile \
            -t ghcr.io/mimir/${{ matrix.service }}:${{ github.sha }} .
          docker push ghcr.io/mimir/${{ matrix.service }}:${{ github.sha }}

  deploy:
    needs: build-and-push
    strategy:
      matrix:
        service: ${{ fromJson(needs.detect-changes.outputs.services) }}
    steps:
      - run: |
          helm upgrade --install mimir-${{ matrix.service }} \
            ./infra/k8s/${{ matrix.service }} \
            --set image.tag=${{ github.sha }} \
            --namespace mimir --wait
```

#### 19.4.2 mimir-web CI Pipeline

```yaml
# mimir-web/.github/workflows/ci.yml
name: Web CI
on:
  push: { branches: [main, develop] }
  pull_request: { branches: [main] }

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci

      # Regenerate API types from staging backend spec before type-checking
      - name: Generate API types
        run: BACKEND_STAGING_URL=${{ vars.BACKEND_STAGING_URL }} bash scripts/generate-api-types.sh

      - run: npm run lint
      - run: npm run type-check    # tsc --noEmit
      - run: npm test              # Vitest unit tests
      - run: npm run build         # Vite production build

  deploy:
    needs: ci
    if: github.ref == 'refs/heads/main'
    steps:
      - run: npm run build
      # Upload dist/ to CDN / static hosting of choice
      - run: <deploy-to-cdn-command>
```

#### 19.4.3 mimir-mobile CI Pipeline

```yaml
# mimir-mobile/.github/workflows/ios-ci.yml
name: iOS CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  ios:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - name: Build & Test
        run: |
          xcodebuild test \
            -project ios/Mimir.xcodeproj \
            -scheme Mimir \
            -destination "platform=iOS Simulator,name=iPhone 15"
      - name: Upload to TestFlight (main only)
        if: github.ref == 'refs/heads/main'
        run: fastlane ios beta   # Fastlane configured separately

# mimir-mobile/.github/workflows/android-ci.yml
name: Android CI
jobs:
  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: 17, distribution: temurin }
      - run: cd android && ./gradlew test
      - run: cd android && ./gradlew assembleRelease
```

### 19.5 Environment Variables Reference

| Variable | Required By | Description |
|---|---|---|
| DATABASE_URL | All services | PostgreSQL connection string (via PgBouncer in prod) |
| REDIS_URL | All services | Redis connection URL |
| JWT_PRIVATE_KEY | Auth Service | RS256 private key for signing JWTs |
| JWT_PUBLIC_KEY | All services | RS256 public key for verifying JWTs |
| ANTHROPIC_API_KEY | AI Service | Anthropic Claude API key |
| GOOGLE_TTS_API_KEY or ELEVENLABS_API_KEY | Study Service | TTS provider credentials *(post-MVP — required when §10 ships in v1.1; do not provision for v1.0)* |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Auth Service | Google OAuth credentials |
| SENDGRID_API_KEY | Notification Service | Email delivery API key |
| FCM_SERVER_KEY | Notification Service | Firebase push notification server key |
| MINIO_ENDPOINT / ACCESS_KEY / SECRET_KEY | Study Service | MinIO connection credentials |
| ELASTICSEARCH_URL | Search Service | Elasticsearch connection URL |
| CLICKHOUSE_URL | Analytics Service | ClickHouse HTTP interface URL |

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
