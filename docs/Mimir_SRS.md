# Software Requirements Specification

## FlashLearn — Word Learning Application

| Field | Value |
|---|---|
| Document Version | 1.0.0 |
| Status | Draft |
| Prepared By | Engineering Team |
| Tech Stack | Node.js · NestJS · Prisma ORM · PostgreSQL · Redis · MinIO |
| Date | 2025 |

---

## Table of Contents

1. [Introduction](#1-introduction)
   - 1.1 [Purpose](#11-purpose)
   - 1.2 [Scope](#12-scope)
   - 1.3 [Definitions, Acronyms, and Abbreviations](#13-definitions-acronyms-and-abbreviations)
   - 1.4 [References](#14-references)
   - 1.5 [Overview](#15-overview)
2. [Overall Description](#2-overall-description)
   - 2.1 [Product Perspective](#21-product-perspective)
   - 2.2 [Product Functions](#22-product-functions)
   - 2.3 [User Classes and Characteristics](#23-user-classes-and-characteristics)
   - 2.4 [Operating Environment](#24-operating-environment)
   - 2.5 [Design and Implementation Constraints](#25-design-and-implementation-constraints)
   - 2.6 [Assumptions and Dependencies](#26-assumptions-and-dependencies)
3. [System Architecture](#3-system-architecture)
   - 3.1 [Module Structure](#31-module-structure)
   - 3.2 [Request Lifecycle](#32-request-lifecycle)
   - 3.3 [Environment Variables](#33-environment-variables)
4. [Data Models](#4-data-models)
   - 4.1 [Entity Relationship Overview](#41-entity-relationship-overview)
   - 4.2 [User](#42-user)
   - 4.3 [StudySet](#43-studyset)
   - 4.4 [Flashcard](#44-flashcard)
   - 4.5 [FlashcardUserState](#45-flashcarduserstate)
   - 4.6 [StudySetCollaborator](#46-studysetcollaborator)
   - 4.7 [FavouriteStudySet](#47-favouritestudyset)
   - 4.8 [Folder and FolderStudySet](#48-folder-and-folderstudyset)
   - 4.9 [Comment](#49-comment)
   - 4.10 [StudySession](#410-studysession)
   - 4.11 [TestAttempt and TestQuestionAttempt](#411-testattempt-and-testquestionattempt)
   - 4.12 [Tag and StudySetTag](#412-tag-and-studysettag)
5. [Functional Requirements](#5-functional-requirements)
   - 5.1 [Authentication](#51-authentication)
   - 5.2 [User Profile](#52-user-profile)
   - 5.3 [Study Sets](#53-study-sets)
   - 5.4 [Flashcards](#54-flashcards)
   - 5.5 [Collaboration](#55-collaboration)
   - 5.6 [Folders](#56-folders)
   - 5.7 [Comments](#57-comments)
   - 5.8 [Tags](#58-tags)
   - 5.9 [Study Modes](#59-study-modes)
   - 5.10 [Spaced Repetition System](#510-spaced-repetition-system)
   - 5.11 [Test Attempts](#511-test-attempts)
   - 5.12 [File Uploads](#512-file-uploads)
6. [Non-Functional Requirements](#6-non-functional-requirements)
   - 6.1 [Performance](#61-performance)
   - 6.2 [Security](#62-security)
   - 6.3 [Reliability and Availability](#63-reliability-and-availability)
   - 6.4 [Scalability](#64-scalability)
   - 6.5 [Maintainability](#65-maintainability)
7. [API Specification](#7-api-specification)
   - 7.1 [Response Envelope](#71-response-envelope)
   - 7.2 [Pagination](#72-pagination)
   - 7.3 [Error Format](#73-error-format)
   - 7.4 [HTTP Status Code Conventions](#74-http-status-code-conventions)
   - 7.5 [Endpoint Reference](#75-endpoint-reference)
8. [Permission and Role System](#8-permission-and-role-system)
   - 8.1 [Role Definitions](#81-role-definitions)
   - 8.2 [Permission Matrix](#82-permission-matrix)
   - 8.3 [Guard Stack](#83-guard-stack)
9. [Business Logic Specifications](#9-business-logic-specifications)
   - 9.1 [SM-2 Spaced Repetition Algorithm](#91-sm-2-spaced-repetition-algorithm)
   - 9.2 [FLASHCARD Mode Logic](#92-flashcard-mode-logic)
   - 9.3 [LEARN Mode Logic](#93-learn-mode-logic)
   - 9.4 [TEST Mode Logic](#94-test-mode-logic)
   - 9.5 [Slug Generation](#95-slug-generation)
   - 9.6 [Soft Delete Strategy](#96-soft-delete-strategy)
10. [File Storage Specification](#10-file-storage-specification)
    - 10.1 [MinIO Bucket Configuration](#101-minio-bucket-configuration)
    - 10.2 [Upload Flow](#102-upload-flow)
    - 10.3 [Pre-signed URL Strategy](#103-pre-signed-url-strategy)
    - 10.4 [Deletion and Cleanup](#104-deletion-and-cleanup)
11. [Testing Requirements](#11-testing-requirements)
    - 11.1 [Unit Testing](#111-unit-testing)
    - 11.2 [Integration and E2E Testing](#112-integration-and-e2e-testing)
    - 11.3 [Test Environment Setup](#113-test-environment-setup)
12. [Future Scope](#12-future-scope)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the complete functional and non-functional requirements for the **FlashLearn** backend application — a word learning platform inspired by Quizlet. The document is intended for the engineering team implementing the system and serves as the authoritative reference for API behavior, data modeling, business logic, and system constraints.

### 1.2 Scope

The document covers the **backend API only**. The frontend client (web or mobile) is out of scope here. The backend is responsible for:

- User authentication (session-based and Google OAuth 2.0)
- Study set and flashcard management
- Four distinct study modes with session tracking
- Spaced repetition scheduling (SM-2 algorithm)
- Role-based collaboration on study sets
- Image file storage via MinIO
- Threaded comments, folders, and tagging

**Out of scope for v1:**

- Real-time collaboration (WebSockets)
- Push notifications
- AI-generated flashcard content
- Payment or subscription management
- Mobile application logic

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|---|---|
| SRS | Software Requirements Specification |
| ORM | Object-Relational Mapper |
| SM-2 | SuperMemo 2 — spaced repetition algorithm |
| EF | Ease Factor — SM-2 parameter (default 2.5, min 1.3) |
| SRS (repetition) | Spaced Repetition System |
| DTO | Data Transfer Object |
| CUID | Collision-resistant Unique Identifier (used as primary key) |
| MinIO | S3-compatible self-hosted object storage |
| TTL | Time-to-live |
| RBAC | Role-Based Access Control |
| FK | Foreign Key |
| PK | Primary Key |

### 1.4 References

- SuperMemo SM-2 Algorithm: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-super-memo-method
- NestJS Documentation: https://docs.nestjs.com
- Prisma Documentation: https://www.prisma.io/docs
- MinIO Node.js Client: https://min.io/docs/minio/linux/developers/javascript/API.html
- IEEE 830-1998 SRS Standard

### 1.5 Overview

The remainder of this document is structured as follows: Section 2 gives a high-level product description. Section 3 covers system architecture. Section 4 defines all data models. Sections 5 and 6 cover functional and non-functional requirements respectively. Section 7 provides the full API specification. Sections 8 and 9 specify the permission model and core business logic. Section 10 covers file storage. Section 11 defines testing requirements. Section 12 outlines planned future scope.

---

## 2. Overall Description

### 2.1 Product Perspective

FlashLearn is a standalone REST API backend. It communicates with a decoupled frontend client over HTTP/HTTPS. The system interacts with the following external systems:

- **PostgreSQL** — primary relational data store
- **Redis** — distributed session store
- **MinIO** — S3-compatible object store for images
- **Google OAuth 2.0** — third-party identity provider

```
┌─────────────────┐        HTTP/REST        ┌─────────────────────────────┐
│  Frontend Client│ ─────────────────────── │     NestJS API Server       │
└─────────────────┘                         │                             │
                                            │  ┌─────────┐  ┌─────────┐  │
                                            │  │ Passport│  │ Prisma  │  │
                                            │  │ (Auth)  │  │  (ORM)  │  │
                                            │  └────┬────┘  └────┬────┘  │
                                            └───────┼────────────┼────────┘
                                                    │            │
                        ┌───────────────────────────┼────────────┼──────────┐
                        │                    ┌──────┴───┐  ┌────┴──────┐    │
                        │  Google OAuth 2.0  │  Redis   │  │ PostgreSQL│    │
                        │                   └──────────┘  └───────────┘    │
                        │                            ┌──────────────┐       │
                        │                            │    MinIO     │       │
                        │                            └──────────────┘       │
                        └──────────────────────────────────────────────────┘
```

### 2.2 Product Functions

At a high level, the system provides:

1. **Identity management** — registration, login, Google OAuth, profile management
2. **Content management** — create, read, update, delete study sets and flashcards
3. **Collaboration** — invite collaborators with OWNER / EDITOR / VIEWER roles
4. **Study modes** — FLASHCARD, LEARN, and TEST sessions with tracking
5. **Spaced repetition** — per-user card scheduling using SM-2
6. **Social features** — favouriting sets, threaded comments, tagging
7. **Organization** — group study sets into personal folders
8. **Media** — upload profile pictures and flashcard images to MinIO

### 2.3 User Classes and Characteristics

| User Class | Description | Access Level |
|---|---|---|
| Guest | Unauthenticated visitor | Read-only on PUBLIC study sets and tags |
| Registered User | Authenticated account holder | Full access to own content and collaboration |
| Collaborator (VIEWER) | Invited to a study set as viewer | Read and study only |
| Collaborator (EDITOR) | Invited to a study set as editor | Modify flashcards and set metadata |
| Collaborator (OWNER) | Creator or promoted owner | Full control including deletion and collaborator management |

### 2.4 Operating Environment

| Component | Version / Spec |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | NestJS 10.x |
| ORM | Prisma 5.x |
| Database | PostgreSQL 16 |
| Cache / Session Store | Redis 7 |
| Object Storage | MinIO (latest stable) |
| Operating System | Linux (Ubuntu 22.04 LTS recommended for production) |
| Container | Docker-compatible; deployable via Dokploy on Contabo VPS |

### 2.5 Design and Implementation Constraints

- All API responses must follow the standard envelope format defined in Section 7.1
- Passwords must never be returned in any API response
- All database interactions must use Prisma transactions where multiple writes are involved
- File uploads must be validated for MIME type and size before being sent to MinIO
- Sessions must be stored in Redis; in-memory session storage is not permitted
- All timestamps must be stored and returned in UTC ISO 8601 format
- Database primary keys use CUIDs (generated by Prisma `@default(cuid())`)

### 2.6 Assumptions and Dependencies

- A PostgreSQL 16 instance is available and accessible via `DATABASE_URL`
- A Redis 7 instance is available via `REDIS_URL`
- A MinIO instance is provisioned with credentials and accessible from the API server
- Google Cloud Console project is configured with OAuth 2.0 credentials
- The frontend client handles cookie-based session management (credentials: 'include' on fetch)
- Domain and HTTPS are configured in production (required for `secure: true` cookie flag)

---

## 3. System Architecture

### 3.1 Module Structure

```
src/
├── main.ts                          # Bootstrap, session middleware, global pipes
├── app.module.ts                    # Root module
│
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts   # @CurrentUser()
│   │   ├── public.decorator.ts         # @Public()
│   │   └── collab-role.decorator.ts    # @RequireCollabRole()
│   ├── filters/
│   │   └── global-exception.filter.ts  # Maps exceptions to HTTP responses
│   ├── guards/
│   │   ├── session.guard.ts            # Global auth guard
│   │   ├── collab.guard.ts             # Study set role guard
│   │   └── throttler.guard.ts          # Rate limiting
│   ├── interceptors/
│   │   ├── transform.interceptor.ts    # Response envelope
│   │   └── logging.interceptor.ts      # Request logging
│   └── pipes/
│       └── validation.pipe.ts          # Global class-validator pipe
│
├── config/
│   └── config.module.ts               # Joi-validated env schema
│
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
│
├── redis/
│   ├── redis.module.ts
│   └── redis.service.ts
│
└── modules/
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── strategies/
    │   │   ├── local.strategy.ts
    │   │   └── google.strategy.ts
    │   └── dto/
    │       ├── register.dto.ts
    │       └── login.dto.ts
    │
    ├── users/
    ├── study-sets/
    ├── flashcards/
    ├── folders/
    ├── comments/
    ├── study-sessions/
    ├── test-attempts/
    ├── tags/
    ├── upload/
    └── spaced-repetition/
```

### 3.2 Request Lifecycle

```
Request
  │
  ├─► Session Middleware         (attaches req.session and req.user)
  ├─► SessionGuard               (401 if no session, unless @Public())
  ├─► ThrottlerGuard             (429 if rate limit exceeded)
  ├─► CollabGuard                (403 if insufficient role — study set routes only)
  ├─► ValidationPipe             (400 if DTO validation fails)
  ├─► Controller Method
  ├─► Service Layer
  │     ├─► PrismaService        (database operations)
  │     └─► SpacedRepetitionService (SM-2 calculations, where applicable)
  ├─► TransformInterceptor       (wraps response in envelope)
  └─► Response

  On error anywhere:
  └─► GlobalExceptionFilter      (maps to standard error response)
```

### 3.3 Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `SESSION_SECRET` | Yes | — | Cookie signing secret (min 32 chars) |
| `SESSION_MAX_AGE_MS` | No | `604800000` | Session TTL (7 days) |
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Yes | — | OAuth redirect URI |
| `MINIO_ENDPOINT` | Yes | — | MinIO server host |
| `MINIO_PORT` | No | `9000` | MinIO port |
| `MINIO_ACCESS_KEY` | Yes | — | MinIO access key |
| `MINIO_SECRET_KEY` | Yes | — | MinIO secret key |
| `MINIO_USE_SSL` | No | `false` | Enable SSL for MinIO |
| `MINIO_BUCKET_AVATARS` | No | `avatars` | Bucket for profile pictures |
| `MINIO_BUCKET_FLASHCARDS` | No | `flashcards` | Bucket for flashcard images |
| `APP_URL` | Yes | — | Base URL (used for OAuth redirects) |
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |
| `THROTTLE_TTL_MS` | No | `900000` | Rate limit window (15 min) |
| `THROTTLE_LIMIT` | No | `10` | Max requests per window |

---

## 4. Data Models

### 4.1 Entity Relationship Overview

```
User ──────────────────────────────────────────────────────────────────────────┐
 │                                                                              │
 ├──< StudySet >──────────────────────────────────────────────────────────────┤
 │       │                                                                      │
 │       ├──< Flashcard >──────────────────────< FlashcardUserState >──────────┤
 │       │                                                                      │
 │       ├──< StudySetCollaborator >──────────────────────────────────────────┤
 │       │                                                                      │
 │       ├──< FavouriteStudySet >────────────────────────────────────────────┤
 │       │                                                                      │
 │       ├──< FolderStudySet >──< Folder >────────────────────────────────────┤
 │       │                                                                      │
 │       ├──< Comment (threaded) >──────────────────────────────────────────┤
 │       │                                                                      │
 │       ├──< StudySession >──────────────────────────────────────────────────┤
 │       │                                                                      │
 │       ├──< TestAttempt >──< TestQuestionAttempt >──< Flashcard >          │
 │       │                                                                      │
 │       └──< StudySetTag >──< Tag >                                           │
 │                                                                              │
 └──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 User

```prisma
model User {
  id             String     @id @default(cuid())
  email          String     @unique
  username       String     @unique
  status         UserStatus @default(ACTIVE)
  password       String?    // null for Google OAuth-only accounts
  profilePicture String?    // MinIO object key (not a URL)
  googleId       String?    @unique
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  studySets          StudySet[]
  collaborations     StudySetCollaborator[]
  favouriteStudySets FavouriteStudySet[]
  folders            Folder[]
  studySessions      StudySession[]
  testAttempts       TestAttempt[]
  flashcardStates    FlashcardUserState[]
  comments           Comment[]
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  DELETED
}
```

**Constraints:**

- `email` and `username` must be globally unique
- `password` is nullable — Google OAuth users have no local password
- `profilePicture` stores the MinIO object key, not a full URL. Pre-signed URLs are generated at query time
- `googleId` is set only for OAuth users and must be unique where non-null

### 4.3 StudySet

```prisma
model StudySet {
  id          String     @id @default(cuid())
  slug        String     @unique
  title       String
  description String?
  visibility  Visibility @default(PUBLIC)
  language    String     @default("en")
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  userId      String     // FK to User (creator/owner)

  owner         User                   @relation(fields: [userId], references: [id])
  flashcards    Flashcard[]
  collaborators StudySetCollaborator[]
  favourites    FavouriteStudySet[]
  folderLinks   FolderStudySet[]
  studySessions StudySession[]
  testAttempts  TestAttempt[]
  comments      Comment[]
  tags          StudySetTag[]
}

enum Visibility {
  PUBLIC    // discoverable in search
  PRIVATE   // owner and collaborators only
  UNLISTED  // accessible via direct link, not in search
}
```

**Constraints:**

- `slug` is auto-generated from `title` (see Section 9.5) and must be globally unique
- Deleting a StudySet cascades to: Flashcards, Comments, StudySetCollaborators, FavouriteStudySets, FolderStudySets, StudySetTags

### 4.4 Flashcard

```prisma
model Flashcard {
  id         String          @id @default(cuid())
  term       String
  definition String
  orderIndex Int
  imageUrl   String?         // MinIO object key (nullable)
  hint       String?
  status     FlashcardStatus @default(ACTIVE)
  studySetId String
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt

  studySet             StudySet               @relation(fields: [studySetId], references: [id], onDelete: Cascade)
  userStates           FlashcardUserState[]
  testQuestionAttempts TestQuestionAttempt[]
}

enum FlashcardStatus {
  ACTIVE
  ARCHIVED
}
```

**Constraints:**

- `orderIndex` values must be contiguous integers starting at 0 per study set. Gaps are normalized on reorder
- `imageUrl` stores the MinIO object key — deletion of the flashcard triggers async removal of the object from MinIO
- `status: ARCHIVED` hides the card from study modes but preserves it and all history records

### 4.5 FlashcardUserState

This table is the core of the spaced repetition engine. One record exists per `(userId, flashcardId)` pair and is created lazily on first review.

```prisma
model FlashcardUserState {
  id              String    @id @default(cuid())
  userId          String
  flashcardId     String
  nextReviewAt    DateTime  @default(now())
  intervalDays    Float     @default(1)
  easeFactor      Float     @default(2.5)   // SM-2 EF; minimum 1.3
  isStarred       Boolean   @default(false)
  correctCount    Int       @default(0)
  incorrectCount  Int       @default(0)
  confidenceLevel Int       @default(0)     // 0–5
  lastReviewedAt  DateTime?

  user      User      @relation(fields: [userId], references: [id])
  flashcard Flashcard @relation(fields: [flashcardId], references: [id], onDelete: Cascade)

  @@unique([userId, flashcardId])
}
```

**Field semantics:**

| Field | Description |
|---|---|
| `nextReviewAt` | DateTime when the card is due for review again |
| `intervalDays` | Current inter-repetition interval in days (SM-2 `I(n)`) |
| `easeFactor` | SM-2 ease factor `EF`; starts at 2.5, minimum 1.3 |
| `isStarred` | User-toggleable star; does not affect SM-2 scheduling |
| `correctCount` | Cumulative count of reviews with quality ≥ 3 |
| `incorrectCount` | Cumulative count of reviews with quality < 3 |
| `confidenceLevel` | Last quality rating (0–5); used for display only |
| `lastReviewedAt` | Timestamp of the most recent review |

### 4.6 StudySetCollaborator

```prisma
model StudySetCollaborator {
  id         String          @id @default(cuid())
  userId     String
  studySetId String
  role       CollaboratorRole

  user     User     @relation(fields: [userId], references: [id])
  studySet StudySet @relation(fields: [studySetId], references: [id], onDelete: Cascade)

  @@unique([userId, studySetId])
}

enum CollaboratorRole {
  OWNER
  EDITOR
  VIEWER
}
```

**Notes:**

- When a user creates a study set, a `StudySetCollaborator` record with `role: OWNER` is automatically created
- A user can only have one role per study set
- The creator's ownership is tracked both via `StudySet.userId` (for fast ownership checks) and via the collaborator record (for the permission query path)

### 4.7 FavouriteStudySet

```prisma
model FavouriteStudySet {
  id         String   @id @default(cuid())
  userId     String
  studySetId String
  createdAt  DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id])
  studySet StudySet @relation(fields: [studySetId], references: [id], onDelete: Cascade)

  @@unique([userId, studySetId])
}
```

Toggling a favourite is idempotent: POST `/study-sets/:slug/favourite` creates the record if absent or deletes it if present (toggle pattern).

### 4.8 Folder and FolderStudySet

```prisma
model Folder {
  id          String   @id @default(cuid())
  userId      String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  owner     User             @relation(fields: [userId], references: [id])
  studySets FolderStudySet[]
}

model FolderStudySet {
  id         String @id @default(cuid())
  folderId   String
  studySetId String

  folder   Folder   @relation(fields: [folderId], references: [id], onDelete: Cascade)
  studySet StudySet @relation(fields: [studySetId], references: [id], onDelete: Cascade)

  @@unique([folderId, studySetId])
}
```

**Notes:**

- A study set can belong to multiple folders (junction table, no limit)
- A user can only add a study set to their own folder
- A user can only add study sets they can access (PUBLIC, UNLISTED, or sets they are a collaborator on)

### 4.9 Comment

```prisma
model Comment {
  id              String   @id @default(cuid())
  userId          String
  studySetId      String
  parentCommentId String?  // null = top-level; non-null = reply
  content         String
  isDeleted       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  author   User      @relation(fields: [userId], references: [id])
  studySet StudySet  @relation(fields: [studySetId], references: [id], onDelete: Cascade)
  parent   Comment?  @relation("Replies", fields: [parentCommentId], references: [id])
  replies  Comment[] @relation("Replies")
}
```

**Notes:**

- Maximum nesting depth is **2 levels** (top-level + one reply level). Replying to a reply is not permitted
- Soft delete: `isDeleted = true` and `content` is replaced with `"[deleted]"`. The record is retained to preserve thread structure
- Only the comment author or the study set OWNER can delete a comment

### 4.10 StudySession

```prisma
model StudySession {
  id               String    @id @default(cuid())
  userId           String
  studySetId       String
  cardsStudied     Int       @default(0)
  correctAnswers   Int       @default(0)
  incorrectAnswers Int       @default(0)
  durationSeconds  Int?
  mode             StudyMode
  startedAt        DateTime  @default(now())
  completedAt      DateTime?

  user     User     @relation(fields: [userId], references: [id])
  studySet StudySet @relation(fields: [studySetId], references: [id])
}

enum StudyMode {
  FLASHCARD
  LEARN
  TEST
}
```

A session is created when a user begins studying (`startedAt = now()`) and completed when they finish (`completedAt = now()`, `durationSeconds` calculated). A session without `completedAt` is considered in-progress.

### 4.11 TestAttempt and TestQuestionAttempt

```prisma
model TestAttempt {
  id             String   @id @default(cuid())
  userId         String
  studySetId     String
  score          Float    // percentage 0.0–100.0
  totalQuestions Int
  createdAt      DateTime @default(now())

  user      User                  @relation(fields: [userId], references: [id])
  studySet  StudySet              @relation(fields: [studySetId], references: [id])
  questions TestQuestionAttempt[]
}

model TestQuestionAttempt {
  id            String  @id @default(cuid())
  testAttemptId String
  flashcardId   String
  userAnswer    String
  isCorrect     Boolean

  testAttempt TestAttempt @relation(fields: [testAttemptId], references: [id], onDelete: Cascade)
  flashcard   Flashcard   @relation(fields: [flashcardId], references: [id])
}
```

### 4.12 Tag and StudySetTag

```prisma
model Tag {
  id        String        @id @default(cuid())
  slug      String        @unique
  name      String
  createdAt DateTime      @default(now())

  studySets StudySetTag[]
}

model StudySetTag {
  id         String @id @default(cuid())
  studySetId String
  tagId      String

  studySet StudySet @relation(fields: [studySetId], references: [id], onDelete: Cascade)
  tag      Tag      @relation(fields: [tagId], references: [id])

  @@unique([studySetId, tagId])
}
```

Tags are global resources. They are created lazily: if a tag with the provided slug does not exist at the time of study set creation or update, it is created automatically.

---

## 5. Functional Requirements

### 5.1 Authentication

#### FR-AUTH-01: Local Registration

- **Input:** `email` (valid email format), `username` (min 3 chars, alphanumeric + underscore), `password` (min 8 chars)
- **Processing:** Validate uniqueness of `email` and `username`. Hash `password` with bcrypt (cost factor 12). Create `User` record. Create session.
- **Output:** `201 Created` with user object (no password field). Session cookie set.
- **Error cases:** `409 Conflict` if email or username already exists. `400 Bad Request` on validation failure.

#### FR-AUTH-02: Local Login

- **Input:** `email`, `password`
- **Processing:** Find user by email. Compare `password` against hash using bcrypt. If match, create session (`req.session.userId = user.id`).
- **Output:** `200 OK` with user object. Session cookie set.
- **Error cases:** `401 Unauthorized` if email not found or password mismatch. `429 Too Many Requests` if rate limit exceeded.

#### FR-AUTH-03: Logout

- **Input:** Valid session cookie.
- **Processing:** Call `req.session.destroy()`. Clear session from Redis.
- **Output:** `200 OK`.
- **Error cases:** `401 Unauthorized` if no session.

#### FR-AUTH-04: Google OAuth Initiation

- **Input:** `GET /auth/google` — no body required.
- **Processing:** Passport redirects to Google consent screen with configured scopes (`email`, `profile`).
- **Output:** `302 Redirect` to Google.

#### FR-AUTH-05: Google OAuth Callback

- **Input:** Authorization code returned by Google to `GET /auth/google/callback`.
- **Processing:**
  1. Exchange code for access token and fetch Google profile
  2. If a `User` with matching `googleId` exists → create session and log in
  3. If a `User` with matching `email` exists but no `googleId` → link `googleId` to existing account, log in
  4. If no match → create new `User` with `googleId`, `email`, and auto-generated `username`. `password = null`
- **Output:** `302 Redirect` to `APP_URL/auth/success` with session cookie set.
- **Error cases:** `302 Redirect` to `APP_URL/auth/error` on failure.

#### FR-AUTH-06: Rate Limiting on Login

- Max **10 login attempts** per IP address per **15-minute window**
- Implemented via `@nestjs/throttler` with a custom `ThrottlerGuard` applied to `POST /auth/login` only
- `429 Too Many Requests` returned when exceeded; `Retry-After` header included

#### FR-AUTH-07: Get Current User

- **Input:** Valid session cookie.
- **Output:** `200 OK` with current user profile (no password).
- **Error cases:** `401 Unauthorized`.

### 5.2 User Profile

#### FR-USER-01: Get Own Profile

Returns the authenticated user's profile including `profilePictureUrl` (pre-signed MinIO URL if `profilePicture` key is set, otherwise `null`).

#### FR-USER-02: Update Profile

- Updatable fields: `username`, `profilePicture` (MinIO object key, after upload)
- `username` uniqueness is validated on update
- Changing `profilePicture` key triggers deletion of the previous object from MinIO

#### FR-USER-03: Change Password

- Available only for local (non-OAuth) accounts
- Requires `currentPassword` for verification before setting `newPassword`
- `newPassword` must be min 8 characters; bcrypt hashed before storage

#### FR-USER-04: Get Public Profile

Returns another user's public profile (`username`, `profilePictureUrl`) and their PUBLIC study sets only. Available to unauthenticated users.

#### FR-USER-05: Delete Account

1. Set `User.status = DELETED`
2. Anonymize: set `email = deleted_{cuid}@deleted.local`, `username = deleted_{cuid}`
3. Delete avatar object from MinIO
4. Set all owned study sets to `visibility: PRIVATE`
5. Destroy current session immediately
6. Return `200 OK`

### 5.3 Study Sets

#### FR-SET-01: Create Study Set

- Authenticated user required
- `slug` auto-generated from `title` (see Section 9.5)
- A `StudySetCollaborator` record with `role: OWNER` is automatically created for the creator
- Tags provided in the create DTO are upserted lazily

#### FR-SET-02: List Public Study Sets

- Publicly accessible (no auth required)
- Supports pagination, full-text search (`q`), filtering by `tag` slug and `language`, and sorting
- Returns only `visibility: PUBLIC` sets

#### FR-SET-03: Get Study Set

- `visibility: PUBLIC` — accessible without authentication
- `visibility: UNLISTED` — accessible to anyone with the slug (no auth required)
- `visibility: PRIVATE` — requires authentication and VIEWER role or higher
- Response includes flashcards, collaborators, and tags

#### FR-SET-04: Update Study Set

- Requires EDITOR role or higher
- Updatable fields: `title`, `description`, `visibility`, `language`, `tags`
- Slug is **not** updated when the title changes (slug is immutable after creation)

#### FR-SET-05: Delete Study Set

- Requires OWNER role
- Cascades to all related records (see Section 4.3)
- MinIO cleanup: all flashcard image keys and no avatar keys are removed asynchronously

#### FR-SET-06: Toggle Favourite

- Authenticated user required
- Idempotent toggle: if favourite exists, delete it; otherwise create it
- Returns `{ favourited: boolean }`

### 5.4 Flashcards

#### FR-CARD-01: Create Flashcard

- Requires EDITOR role on the study set
- `orderIndex` is assigned as `MAX(current orderIndex) + 1` within the study set

#### FR-CARD-02: Bulk Create Flashcards

- Accepts an array of flashcard objects (max 500 per request)
- Assigned `orderIndex` values sequentially starting from the current max
- Executed in a single Prisma `createMany` call

#### FR-CARD-03: Update Flashcard

- Requires EDITOR role on the parent study set
- Updatable fields: `term`, `definition`, `hint`, `imageUrl`, `status`
- Changing `imageUrl` triggers deletion of the previous key from MinIO

#### FR-CARD-04: Delete Flashcard

- Requires EDITOR role on the parent study set
- Triggers MinIO deletion of `imageUrl` if set (asynchronous, non-blocking)

#### FR-CARD-05: Reorder Flashcards

- Requires EDITOR role
- Accepts an ordered array of flashcard IDs: `{ order: string[] }`
- Server assigns `orderIndex` 0, 1, 2... in the provided sequence
- Executed in a Prisma transaction using `Promise.all` over individual updates

#### FR-CARD-06: Toggle Star

- Any authenticated user who has access to the study set
- Upserts `FlashcardUserState` and toggles `isStarred`

### 5.5 Collaboration

#### FR-COLLAB-01: Add Collaborator

- Requires OWNER role
- Body: `{ email: string, role: CollaboratorRole }`
- The invited user must already have a registered account
- Cannot add a user who is already a collaborator
- Cannot assign `OWNER` role (use FR-COLLAB-03 for promotions)

#### FR-COLLAB-02: Remove Collaborator

- Requires OWNER role
- Owner cannot remove themselves via this endpoint (use account deletion for that)

#### FR-COLLAB-03: Update Collaborator Role

- Requires OWNER role
- Can change any collaborator's role to EDITOR or VIEWER
- Cannot demote/promote the OWNER's own record

#### FR-COLLAB-04: List Collaborators

- Requires VIEWER role or higher
- Returns list of collaborators with their roles and user public info

### 5.6 Folders

#### FR-FOLDER-01: Create Folder

- Authenticated user required
- Fields: `description` (optional)

#### FR-FOLDER-02: List Own Folders

- Returns all folders belonging to the authenticated user, with study set count

#### FR-FOLDER-03: Get Folder

- Returns folder details with all contained study sets (summary, not full flashcard list)
- Only the folder owner can access their folders

#### FR-FOLDER-04: Add Study Set to Folder

- The study set must be accessible to the user (PUBLIC, UNLISTED, or collaborator)
- Duplicate entries are rejected (`409 Conflict`)

#### FR-FOLDER-05: Remove Study Set from Folder

- Folder owner only

#### FR-FOLDER-06: Delete Folder

- Deletes the folder and all `FolderStudySet` links
- Does not delete the study sets themselves

### 5.7 Comments

#### FR-COMMENT-01: Post Top-Level Comment

- Authenticated user required
- Must have access to the study set

#### FR-COMMENT-02: Post Reply

- `parentCommentId` must reference an existing, non-deleted, top-level comment
- Replying to a reply is rejected with `400 Bad Request`

#### FR-COMMENT-03: Edit Comment

- Comment author only
- Allowed only within **10 minutes** of `createdAt`
- Only `content` is editable

#### FR-COMMENT-04: Delete Comment

- Comment author or study set OWNER can delete
- Soft delete: `isDeleted = true`, `content = "[deleted]"`
- The comment record and its replies are preserved for thread integrity

#### FR-COMMENT-05: List Comments

- Returns top-level comments with nested replies
- `isDeleted = true` comments show `content: "[deleted]"` and no author info

### 5.8 Tags

#### FR-TAG-01: List All Tags

- Publicly accessible
- Returns each tag with its associated study set count

#### FR-TAG-02: Get Tag

- Returns tag detail and a paginated list of PUBLIC study sets with that tag

#### FR-TAG-03: Add Tags to Study Set

- Requires EDITOR role
- Tags are upserted by slug (created if not existing)
- Existing tag associations are not duplicated

#### FR-TAG-04: Remove Tag from Study Set

- Requires EDITOR role
- Removes the `StudySetTag` junction record
- Does not delete the `Tag` record itself

### 5.9 Study Modes

#### FR-MODE-01: Start Study Session

- **Input:** `{ studySetId: string, mode: StudyMode }`
- **Processing:** Validate user has at least VIEWER access. Create `StudySession` with `startedAt = now()`, `completedAt = null`.
- **Output:** `201 Created` with session record. For LEARN mode, also returns the due-cards queue.

#### FR-MODE-02: Complete Study Session

- **Input:** Session ID + `{ cardsStudied, correctAnswers, incorrectAnswers, durationSeconds }`
- **Processing:** Set `completedAt = now()`. Update stats on the session record.
- **Output:** `200 OK` with completed session including a mastery summary.

#### FR-MODE-03: Card Result (FLASHCARD / LEARN)

- **Input:** `{ flashcardId: string, quality: number }`
  - For FLASHCARD mode, `quality` is binary: correct = 4, incorrect = 1 (client may pass `correct: boolean`)
  - For LEARN mode, `quality` is 0–5 as rated by the user
- **Processing:** Increment session counters. Trigger SM-2 update (Section 9.1).
- **Output:** `200 OK` with updated `FlashcardUserState`.

### 5.10 Spaced Repetition System

Full specification in Section 9.1. Key requirements:

#### FR-SRS-01: Review Submission

- Endpoint: `POST /flashcards/:id/review`
- Input: `{ quality: number }` where quality is 0–5
- Upserts `FlashcardUserState` (creates with defaults if first review)
- Calls SM-2 algorithm, persists result, returns updated state

#### FR-SRS-02: Due Cards Queue

- Endpoint: `GET /study-sets/:slug/due-cards`
- Returns flashcards where `FlashcardUserState.nextReviewAt <= NOW()` for the authenticated user
- Ordered by `nextReviewAt ASC`
- Cards with no `FlashcardUserState` record are treated as due immediately

#### FR-SRS-03: Progress Summary

- Endpoint: `GET /study-sets/:slug/progress`
- Returns per-set aggregate stats:
  - Total cards, cards mastered (`EF >= 2.0`), cards due today, cards not yet started
  - Average ease factor, average interval

### 5.11 Test Attempts

#### FR-TEST-01: Create Test Attempt

- **Input:** `{ studySetId: string, questionCount?: number }` (default 20, max 20)
- **Processing:**
  1. Sample up to 20 ACTIVE flashcards randomly from the set
  2. For each flashcard, generate one question:
     - If set has ≥ 4 cards: multiple-choice with 3 distractors (randomly sampled from other cards' definitions)
     - If set has < 4 cards: written-answer only
  3. Create `TestAttempt` record with `score = 0`, `totalQuestions = n`
  4. Return the question list to the client (without correct answers)
- **Output:** `201 Created` with `{ testAttemptId, questions: [{ flashcardId, term, type, options? }] }`

#### FR-TEST-02: Submit Test Attempt

- **Input:** `{ answers: [{ flashcardId: string, userAnswer: string }] }`
- **Processing:**
  1. Evaluate each answer: compare `userAnswer.trim().toLowerCase()` against `flashcard.definition.trim().toLowerCase()`
  2. Create `TestQuestionAttempt` for each answer
  3. Calculate `score = (correctCount / totalQuestions) * 100`
  4. Update `TestAttempt.score`
  5. Apply SM-2 update per card: `quality = isCorrect ? 4 : 2`
- **Output:** `200 OK` with `{ score, totalQuestions, correctCount, incorrectCount, answers: [...] }`

#### FR-TEST-03: Get Test History

- **Input:** Authenticated user, optional `studySetId` filter
- **Output:** Paginated list of `TestAttempt` records

### 5.12 File Uploads

#### FR-UPLOAD-01: Upload Avatar

- `POST /upload/avatar` — multipart/form-data, field name `file`
- Max size: 2 MB
- Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`
- Generates key: `avatars/{userId}/{uuid}.{ext}`
- Returns `{ key: string }` — caller stores this key on `User.profilePicture`

#### FR-UPLOAD-02: Delete Avatar

- `DELETE /upload/avatar`
- Deletes current avatar object from MinIO
- Sets `User.profilePicture = null`

#### FR-UPLOAD-03: Upload Flashcard Image

- `POST /upload/flashcard-image` — multipart/form-data, field name `file`
- Max size: 5 MB
- Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- Generates key: `flashcards/{userId}/{uuid}.{ext}`
- Returns `{ key: string }` — caller stores this key on `Flashcard.imageUrl`

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Requirement | Target |
|---|---|
| API response time (p95) | < 300 ms for read endpoints under normal load |
| API response time (p95) | < 500 ms for write endpoints |
| File upload throughput | Support uploads up to 5 MB within 10 seconds |
| Session lookup | < 5 ms (Redis in-memory store) |
| Database queries | All queries on indexed columns; no unbounded table scans |
| Pagination | All list endpoints paginated; max 50 items per page |

**Indexing requirements:**

```prisma
// Required indexes beyond PK and FK defaults
@@index([userId])           // on StudySession, FavouriteStudySet, FlashcardUserState
@@index([studySetId])       // on Flashcard, Comment, StudySession, TestAttempt
@@index([nextReviewAt])     // on FlashcardUserState (due-cards queue)
@@index([slug])             // on StudySet (lookup by slug — already unique, covers this)
@@index([visibility])       // on StudySet (public listing filter)
@@index([createdAt])        // on StudySet (default sort)
```

### 6.2 Security

| Requirement | Detail |
|---|---|
| Password hashing | bcrypt with cost factor 12 |
| Session cookies | `httpOnly: true`, `secure: true` (production), `sameSite: 'lax'` |
| Session storage | Redis; sessions invalidated on logout and account deletion |
| Password exposure | `password` field excluded from all Prisma queries by default using `select: { password: false }` in a base user query builder |
| Rate limiting | Login endpoint: 10 requests / 15 min / IP via `@nestjs/throttler` |
| Input validation | All incoming data validated via `class-validator` DTOs; unknown fields stripped |
| SQL injection | Mitigated entirely by Prisma's parameterised query builder |
| MIME sniffing | MIME type validated server-side via `file-type` package (reads file magic bytes, not just Content-Type header) |
| CORS | Configured to allow only the `APP_URL` origin with `credentials: true` |
| Helmet | `@nestjs/platform-express` with `helmet()` middleware for standard HTTP security headers |

### 6.3 Reliability and Availability

- All multi-step writes use Prisma transactions to ensure atomicity
- SM-2 updates and session counter increments are transactional
- MinIO operations (upload/delete) that fail do not roll back the database write; instead they are queued for an async retry via a scheduled cleanup job (weekly)
- The API is stateless (sessions in Redis); horizontal scaling is possible without sticky sessions
- Database connection pooling is handled by Prisma's built-in connection pool

### 6.4 Scalability

- The session store (Redis) is external and can be scaled independently
- MinIO supports horizontal scaling via distributed mode
- NestJS application is stateless and can run as multiple instances behind a load balancer
- Prisma connection pool size should be tuned per instance: `connection_limit = (CPU_CORES * 2) + 1`

### 6.5 Maintainability

- All modules follow NestJS's dependency injection pattern
- Business logic resides in services, not controllers
- DTOs enforce contract; API consumers are decoupled from internal models
- Prisma migrations are version-controlled in `prisma/migrations/`
- Environment variables validated at startup via Joi schema in `ConfigModule`
- All public service methods documented with JSDoc
- ESLint + Prettier enforced; no build passes with lint errors

---

## 7. API Specification

### 7.1 Response Envelope

All successful responses are wrapped in a standard envelope by the `TransformInterceptor`.

**Single resource:**

```json
{
  "data": { }
}
```

**Collection (paginated):**

```json
{
  "data": [],
  "meta": {
    "total": 142,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 7.2 Pagination

All list endpoints accept the following query parameters:

| Param | Type | Default | Constraints |
|---|---|---|---|
| `page` | integer | `1` | Min 1 |
| `limit` | integer | `20` | Min 1, Max 50 |

### 7.3 Error Format

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "StudySet not found",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/study-sets/non-existent-slug"
}
```

Validation errors include a `details` array:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    { "field": "email", "message": "email must be an email" },
    { "field": "password", "message": "password must be longer than or equal to 8 characters" }
  ]
}
```

### 7.4 HTTP Status Code Conventions

| Code | Scenario |
|---|---|
| `200 OK` | Successful GET, PATCH |
| `201 Created` | Successful POST (resource created) |
| `204 No Content` | Successful DELETE (no body) |
| `400 Bad Request` | Validation error, malformed request body |
| `401 Unauthorized` | Missing or expired session |
| `403 Forbidden` | Authenticated but insufficient role/permission |
| `404 Not Found` | Resource does not exist or not accessible to caller |
| `409 Conflict` | Unique constraint violation |
| `413 Payload Too Large` | File upload exceeds size limit |
| `415 Unsupported Media Type` | Invalid MIME type for file upload |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unhandled exception |

### 7.5 Endpoint Reference

#### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register with email and password |
| `POST` | `/auth/login` | Public | Login, receive session cookie |
| `POST` | `/auth/logout` | Required | Destroy session |
| `GET` | `/auth/me` | Required | Get current user |
| `GET` | `/auth/google` | Public | Initiate Google OAuth |
| `GET` | `/auth/google/callback` | Public | Google OAuth callback |

#### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users/me` | Required | Get own profile |
| `PATCH` | `/users/me` | Required | Update profile (username, avatar) |
| `PATCH` | `/users/me/password` | Required | Change password |
| `DELETE` | `/users/me` | Required | Delete own account |
| `GET` | `/users/:username` | Optional | Get public profile |

#### Study Sets

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/study-sets` | Optional | — | List public sets |
| `POST` | `/study-sets` | Required | — | Create set |
| `GET` | `/study-sets/:slug` | Optional* | Viewer+ | Get set with flashcards |
| `PATCH` | `/study-sets/:slug` | Required | Editor+ | Update set metadata |
| `DELETE` | `/study-sets/:slug` | Required | Owner | Delete set |
| `POST` | `/study-sets/:slug/favourite` | Required | — | Toggle favourite |
| `GET` | `/users/me/favourites` | Required | — | List favourited sets |

#### Collaborators

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/study-sets/:slug/collaborators` | Required | Viewer+ | List collaborators |
| `POST` | `/study-sets/:slug/collaborators` | Required | Owner | Add collaborator |
| `PATCH` | `/study-sets/:slug/collaborators/:userId` | Required | Owner | Change role |
| `DELETE` | `/study-sets/:slug/collaborators/:userId` | Required | Owner | Remove collaborator |

#### Flashcards

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/study-sets/:slug/flashcards` | Optional* | Viewer+ | List flashcards |
| `POST` | `/study-sets/:slug/flashcards` | Required | Editor+ | Create flashcard |
| `POST` | `/study-sets/:slug/flashcards/bulk` | Required | Editor+ | Bulk create |
| `PATCH` | `/flashcards/:id` | Required | Editor+ | Update flashcard |
| `DELETE` | `/flashcards/:id` | Required | Editor+ | Delete flashcard |
| `PATCH` | `/study-sets/:slug/flashcards/reorder` | Required | Editor+ | Reorder |
| `POST` | `/flashcards/:id/star` | Required | — | Toggle star |
| `POST` | `/flashcards/:id/review` | Required | — | Submit SM-2 quality rating |
| `GET` | `/flashcards/:id/state` | Required | — | Get user state |

#### Spaced Repetition

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/study-sets/:slug/due-cards` | Required | Cards due for review |
| `GET` | `/study-sets/:slug/progress` | Required | Aggregate SRS progress |

#### Folders

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/folders` | Required | List own folders |
| `POST` | `/folders` | Required | Create folder |
| `GET` | `/folders/:id` | Required | Get folder with sets |
| `PATCH` | `/folders/:id` | Required | Update folder |
| `DELETE` | `/folders/:id` | Required | Delete folder |
| `POST` | `/folders/:id/study-sets/:slug` | Required | Add set to folder |
| `DELETE` | `/folders/:id/study-sets/:slug` | Required | Remove set from folder |

#### Comments

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/study-sets/:slug/comments` | Optional* | List comments with replies |
| `POST` | `/study-sets/:slug/comments` | Required | Post top-level comment |
| `POST` | `/comments/:id/replies` | Required | Reply to a comment |
| `PATCH` | `/comments/:id` | Required | Edit comment (author only, 10 min window) |
| `DELETE` | `/comments/:id` | Required | Soft-delete comment |

#### Tags

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/tags` | Public | — | List all tags |
| `GET` | `/tags/:slug` | Public | — | Get tag with sets |
| `POST` | `/study-sets/:slug/tags` | Required | Editor+ | Add tags to set |
| `DELETE` | `/study-sets/:slug/tags/:tagId` | Required | Editor+ | Remove tag from set |

#### Study Sessions

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/study-sessions` | Required | Start session |
| `POST` | `/study-sessions/:id/card-result` | Required | Record card result |
| `POST` | `/study-sessions/:id/complete` | Required | Complete session |
| `GET` | `/study-sessions` | Required | List sessions |
| `GET` | `/study-sessions/:id` | Required | Get session |

#### Test Attempts

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/test-attempts` | Required | Create test attempt |
| `POST` | `/test-attempts/:id/submit` | Required | Submit answers |
| `GET` | `/test-attempts` | Required | List test history |
| `GET` | `/test-attempts/:id` | Required | Get attempt detail |

#### Uploads

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/upload/avatar` | Required | Upload profile picture |
| `DELETE` | `/upload/avatar` | Required | Delete profile picture |
| `POST` | `/upload/flashcard-image` | Required | Upload flashcard image |

---

## 8. Permission and Role System

### 8.1 Role Definitions

#### OWNER

- Created automatically when a user creates a study set
- There is always exactly one OWNER per study set
- Full CRUD on the study set, all flashcards, and all collaborators
- Can delete the study set
- Can promote an EDITOR to OWNER (which simultaneously demotes the current OWNER to EDITOR)
- Cannot be removed by another collaborator

#### EDITOR

- Invited by the OWNER
- Can create, update, and delete flashcards
- Can update study set metadata (title, description, visibility, language, tags)
- Cannot delete the study set
- Cannot manage collaborators
- Cannot change the study set owner

#### VIEWER

- Invited by the OWNER
- Read-only access to the study set and its flashcards
- Can study the set (create study sessions, submit SM-2 reviews)
- Can comment on the study set
- Cannot modify any content

### 8.2 Permission Matrix

| Action | Guest | Viewer | Editor | Owner |
|---|---|---|---|---|
| View PUBLIC / UNLISTED set | ✅ | ✅ | ✅ | ✅ |
| View PRIVATE set | ❌ | ✅ | ✅ | ✅ |
| Study (all modes) | ❌ | ✅ | ✅ | ✅ |
| Comment | ❌ | ✅ | ✅ | ✅ |
| Favourite | ❌ | ✅ | ✅ | ✅ |
| Create flashcard | ❌ | ❌ | ✅ | ✅ |
| Update flashcard | ❌ | ❌ | ✅ | ✅ |
| Delete flashcard | ❌ | ❌ | ✅ | ✅ |
| Reorder flashcards | ❌ | ❌ | ✅ | ✅ |
| Update set metadata | ❌ | ❌ | ✅ | ✅ |
| Manage tags | ❌ | ❌ | ✅ | ✅ |
| Delete set | ❌ | ❌ | ❌ | ✅ |
| Add collaborators | ❌ | ❌ | ❌ | ✅ |
| Remove collaborators | ❌ | ❌ | ❌ | ✅ |
| Change collaborator role | ❌ | ❌ | ❌ | ✅ |
| Delete any comment | ❌ | ❌ | ❌ | ✅ |

### 8.3 Guard Stack

```typescript
// Global — applied to every route
@UseGuards(SessionGuard)

// Study set routes — applied after SessionGuard
@UseGuards(CollabGuard)
@RequireCollabRole(CollaboratorRole.EDITOR) // minimum required role
```

#### SessionGuard

Reads `req.session.userId`. If absent and the route is not decorated with `@Public()`, throws `401 UnauthorizedException`. On success, fetches the user from the database and attaches to `req.user`.

#### CollabGuard

1. Extracts `slug` from route params
2. Fetches the `StudySet` by slug
3. If set is `PRIVATE` and user is not authenticated → `403 ForbiddenException`
4. Checks if `StudySet.userId === req.user.id` → role is OWNER
5. Otherwise queries `StudySetCollaborator` for `(req.user.id, studySet.id)`
6. Compares resolved role against the `@RequireCollabRole()` minimum
7. If insufficient → `403 ForbiddenException`

---

## 9. Business Logic Specifications

### 9.1 SM-2 Spaced Repetition Algorithm

#### Quality Rating Scale

| Quality | Meaning |
|---|---|
| `5` | Perfect recall, no hesitation |
| `4` | Correct with slight hesitation |
| `3` | Correct with serious difficulty |
| `2` | Incorrect; remembered on seeing answer |
| `1` | Incorrect; easy to remember the answer |
| `0` | Complete blackout |

Quality ≥ 3 is considered a **correct** response. Quality < 3 is a **failed** response.

#### Algorithm

```typescript
interface SM2Input {
  quality: number;       // 0–5
  easeFactor: number;    // current EF (default 2.5, min 1.3)
  intervalDays: number;  // current interval in days
  repetitions: number;   // number of consecutive correct repetitions
}

interface SM2Output {
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: Date;
}

function calculateSM2(input: SM2Input): SM2Output {
  const { quality, easeFactor, intervalDays, repetitions } = input;

  // Step 1: Recalculate Ease Factor
  let newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEF < 1.3) newEF = 1.3; // EF floor

  // Step 2: Recalculate Interval
  let newInterval: number;

  if (quality < 3) {
    // Failed response: reset to start
    newInterval = 1;
    // Note: repetitions counter is reset to 0 by the caller
  } else {
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(intervalDays * newEF);
    }
  }

  // Step 3: Calculate next review date
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);
  nextReviewAt.setHours(0, 0, 0, 0); // schedule for start of day

  return { easeFactor: newEF, intervalDays: newInterval, nextReviewAt };
}
```

#### Review Transaction (SpacedRepetitionService.submitReview)

Executed as a Prisma transaction:

```typescript
async submitReview(userId: string, flashcardId: string, quality: number) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Upsert state with defaults
    let state = await tx.flashcardUserState.upsert({
      where: { userId_flashcardId: { userId, flashcardId } },
      create: { userId, flashcardId },
      update: {},
    });

    const repetitions = state.correctCount; // proxy for repetition count

    // 2. Run SM-2
    const result = calculateSM2({
      quality,
      easeFactor: state.easeFactor,
      intervalDays: state.intervalDays,
      repetitions: quality < 3 ? 0 : repetitions,
    });

    // 3. Persist
    return tx.flashcardUserState.update({
      where: { userId_flashcardId: { userId, flashcardId } },
      data: {
        easeFactor:     result.easeFactor,
        intervalDays:   result.intervalDays,
        nextReviewAt:   result.nextReviewAt,
        lastReviewedAt: new Date(),
        confidenceLevel: Math.min(5, quality),
        correctCount:   quality >= 3 ? { increment: 1 } : state.correctCount,
        incorrectCount: quality < 3  ? { increment: 1 } : state.incorrectCount,
      },
    });
  });
}
```

### 9.2 FLASHCARD Mode Logic

1. Client starts session: `POST /study-sessions` with `mode: FLASHCARD`
2. Client fetches cards: `GET /study-sets/:slug/flashcards`
3. Client presents cards in sequence (shuffled or ordered — client controls this)
4. For each card, user taps "Know it" or "Don't know it"
5. Client sends: `POST /study-sessions/:id/card-result` with `{ flashcardId, quality: 4 | 1 }`
6. Server increments session counters and triggers SM-2 update
7. Client sends: `POST /study-sessions/:id/complete`

No server-side queue management is required for FLASHCARD mode.

### 9.3 LEARN Mode Logic

1. Client starts session: `POST /study-sessions` with `mode: LEARN`
2. Server returns due-cards queue (`nextReviewAt <= NOW()`) ordered by `nextReviewAt ASC`
   - Cards with no `FlashcardUserState` are included (treated as immediately due)
3. Client presents cards one at a time; user rates each 0–5
4. Client sends: `POST /study-sessions/:id/card-result` with `{ flashcardId, quality }`
5. Server applies full SM-2 update
6. **Re-queue logic (client-side):** cards with `quality < 3` are appended to the end of the current session queue
7. Session ends when all cards have been answered with `quality >= 3` at least once in this session
8. Client sends: `POST /study-sessions/:id/complete`
9. Server computes **mastery score**: count of cards with `easeFactor >= 2.0` divided by total cards in the set

### 9.4 TEST Mode Logic

#### Question Generation (server-side)

```typescript
function generateQuestions(flashcards: Flashcard[], count: number): Question[] {
  const selected = shuffle(flashcards).slice(0, Math.min(count, 20));
  const useMultipleChoice = flashcards.length >= 4;

  return selected.map((card) => {
    if (!useMultipleChoice) {
      return { type: 'WRITTEN', flashcardId: card.id, term: card.term };
    }

    // 3 distractors: random definitions from other cards
    const distractors = shuffle(
      flashcards.filter((f) => f.id !== card.id).map((f) => f.definition)
    ).slice(0, 3);

    const options = shuffle([card.definition, ...distractors]);

    return {
      type: 'MULTIPLE_CHOICE',
      flashcardId: card.id,
      term: card.term,
      options,
    };
  });
}
```

#### Answer Evaluation

```typescript
function isAnswerCorrect(userAnswer: string, correctAnswer: string): boolean {
  return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}
```

#### Score Calculation

```typescript
score = (correctAnswers / totalQuestions) * 100; // stored as Float
```

### 9.5 Slug Generation

```typescript
import { slugify } from 'transliteration';
import { createId } from '@paralleldrive/cuid2';

function generateSlug(title: string): string {
  const base = slugify(title, { lowercase: true, separator: '-' })
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60);

  const suffix = createId().slice(0, 8);
  return `${base}-${suffix}`;
}
```

- Slug is set at creation and is **immutable** thereafter
- The suffix ensures global uniqueness even for identical titles
- Maximum total length: 69 characters

### 9.6 Soft Delete Strategy

| Entity | Strategy | Rationale |
|---|---|---|
| User | Soft (status=DELETED + anonymize) | Preserve study history integrity |
| Comment | Soft (isDeleted=true + content=[deleted]) | Preserve thread structure |
| StudySet | Hard delete + cascade | Owner-controlled; cascades clean all children |
| Flashcard | Hard delete (status=ARCHIVED for hiding) | Archive preserves history; hard delete on set deletion |
| FlashcardUserState | Hard delete on flashcard deletion | No orphaned SRS data |

---

## 10. File Storage Specification

### 10.1 MinIO Bucket Configuration

| Bucket | Default Name | Access Policy | Max File Size | Accepted MIMEs |
|---|---|---|---|---|
| Avatars | `avatars` | Private (pre-signed only) | 2 MB | `image/jpeg`, `image/png`, `image/webp` |
| Flashcard images | `flashcards` | Private (pre-signed only) | 5 MB | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |

Both buckets must be created on MinIO startup if they do not exist (handled in `UploadModule.onModuleInit()`).

### 10.2 Upload Flow

```
Client
  │
  ├─ POST /upload/avatar  (multipart/form-data, field: file)
  │
Server
  ├─ FileInterceptor validates MIME via magic bytes (file-type package)
  ├─ Validates file size
  ├─ Generates object key: {bucket}/{userId}/{uuid}.{ext}
  ├─ Streams file buffer to MinIO via minioClient.putObject()
  └─ Returns { key: string }

Client
  └─ PATCH /users/me  { profilePicture: key }  — stores key on user record
```

### 10.3 Pre-signed URL Strategy

Pre-signed URLs are generated on-the-fly by `UploadService.getPresignedUrl(key, ttlSeconds)` and embedded in response DTOs. They are **never stored** in the database.

```typescript
async getPresignedUrl(key: string, ttlSeconds = 3600): Promise<string> {
  return this.minioClient.presignedGetObject(
    this.getBucketFromKey(key),
    key,
    ttlSeconds,
  );
}
```

| Asset | TTL |
|---|---|
| Profile picture | 1 hour (3600 s) |
| Flashcard image | 1 hour (3600 s) |

### 10.4 Deletion and Cleanup

**Immediate deletion** (synchronous):
- On `DELETE /upload/avatar`: deletes current avatar key from MinIO, sets `User.profilePicture = null`
- On `DELETE /flashcards/:id` when `imageUrl` is set: MinIO deletion is attempted after DB delete

**Async cleanup job** (weekly, via `@nestjs/schedule`):
- Lists all keys in both buckets
- Cross-references with all `imageUrl` and `profilePicture` values in the database
- Deletes any keys not referenced in the database (orphaned objects from failed transactions)

---

## 11. Testing Requirements

### 11.1 Unit Testing

The following service methods require unit test coverage (Jest):

| Service | Methods to Test |
|---|---|
| `SpacedRepetitionService` | `calculateSM2` — quality 0/3/5, EF minimum clamp (newEF must not drop below 1.3), interval progression for n=0/1/n, failed response reset |
| `AuthService` | Password hashing, bcrypt comparison, session creation, Google OAuth user creation and linking |
| `StudySetsService` | Slug generation uniqueness, collaborator role assignment on creation, cascade behaviour |
| `TestAttemptsService` | Score calculation, distractor selection (no duplicates, no correct answer as distractor), answer evaluation (case/trim) |
| `UploadService` | MIME validation rejection, key generation format, pre-signed URL TTL |
| `CommentsService` | Nesting depth enforcement (reject depth > 2), soft delete content replacement, 10-minute edit window enforcement |

### 11.2 Integration and E2E Testing

Full E2E tests using `Supertest` against a running NestJS application with a test PostgreSQL database:

| Test Suite | Scenarios |
|---|---|
| Auth | Register → login → access protected route → logout → 401 on next request |
| Google OAuth | Mock GoogleStrategy → new user created → session set |
| Study Set CRUD | Create → get → update → delete; slug immutability |
| Collaboration | Add VIEWER → confirm cannot edit → change to EDITOR → confirm can edit → remove |
| Flashcard lifecycle | Create → bulk create → reorder → update → delete; SM-2 state created on first review |
| SM-2 cycle | Submit quality 5 → verify EF increase → submit quality 0 → verify EF decrease and interval reset |
| Test Mode | Create attempt → verify no correct answers in response → submit → verify score and SM-2 updates |
| File upload | Valid JPEG accepted → oversized file rejected (413) → wrong MIME rejected (415) |
| Comments | Post → reply → reject reply-to-reply → soft delete → content replaced |
| Pagination | Verify `meta.total`, `hasNextPage`, `hasPrevPage` correctness |

### 11.3 Test Environment Setup

```bash
# .env.test
DATABASE_URL="postgresql://user:pass@localhost:5432/flashlearn_test"
REDIS_URL="redis://localhost:6379/1"
SESSION_SECRET="test-secret-32-chars-minimum"
MINIO_BUCKET_AVATARS="test-avatars"
MINIO_BUCKET_FLASHCARDS="test-flashcards"
```

- Run `prisma migrate deploy` before test suite
- Truncate all tables in reverse FK order between test suites (not between individual tests in the same suite)
- MinIO test buckets purged in `afterAll` hooks
- Google OAuth tested with a `jest.spyOn` on `GoogleStrategy.validate`

---

## 12. Future Scope

The following features are planned for subsequent versions and are **explicitly excluded from v1**.

| Feature | Description | Target Version |
|---|---|---|
| WebSocket Collaboration | Socket.IO gateway for live co-editing; cursor presence indicators | v2 |
| AI Flashcard Generation | `POST /study-sets/:slug/ai-generate` — LLM generates cards from pasted text | v2 |
| Daily Study Streak | Streak counter per user; incremented on any completed session per calendar day | v2 |
| Due-Card Push Notifications | Web Push API notifications when cards are due for review | v2 |
| CSV / Quizlet Import | Parse Quizlet export format and CSV; map to bulk flashcard creation | v2 |
| PDF / CSV Export | Export a study set's flashcards as PDF or CSV | v2 |
| Audio Pronunciation | TTS-generated audio clip per flashcard, stored in MinIO | v3 |
| Admin Dashboard | Protected `/admin/*` routes for user management and tag moderation | v3 |
| Subscription Tiers | Stripe integration; private sets and advanced stats gated behind paid plan | v3 |
| Mobile App Backend Extensions | Device token management, offline sync via delta endpoints | v3 |

---

*End of SRS — FlashLearn v1.0*
