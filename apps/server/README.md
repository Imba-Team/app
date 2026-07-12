# Imba Learn Server

Comprehensive backend for a quizlet-style application built with NestJS, TypeORM and PostgreSQL. This document describes how to setup, run, test, and work with the project. It also contains a compact API reference and examples.

---

## Table of Contents

- Project overview
- Tech stack
- Prerequisites
- Environment variables
- Installation
- Database & migrations
- Running the app
- Testing
- API reference (authentication, modules, terms, users)
- DTOs and responses
- Troubleshooting
- Contributing

---

## Project overview

This repository provides the server-side API for a study modules application. It supports user authentication (email/password and Google OAuth2), module management (create/update/list/delete), and term management inside modules. The app uses JWTs stored in cookies for authentication and TypeORM for database access.

## Tech stack

- NestJS (v11)
- TypeScript
- TypeORM (v0.3)
- PostgreSQL (pg)
- Passport + passport-jwt / passport-google-oauth2
- Jest + Supertest for tests

## Prerequisites

- Node.js (recommended LTS, e.g., 18+)
- pnpm (optional) or npm / yarn
- PostgreSQL database

Install dependencies:

```bash
pnpm install
# or
npm install
```

## Environment variables

Create a `.env` file at the project root (or otherwise provide env vars to your runtime environment). The application reads configuration using `@nestjs/config`.

Minimum useful variables:

- `NODE_ENV` - `development` | `production`
- Database:
  - `DATABASE_HOST` - database host
  - `DATABASE_PORT` - database port (e.g. 5432)
  - `DATABASE_USER` - database username
  - `DATABASE_PASSWORD` - database password
  - `DATABASE_NAME` - database name
- Authentication / cookies:
  - `JWT_SECRET` - secret used to sign JWT tokens
  - `JWT_EXPIRES_IN` - token TTL (e.g. `7d` or `3600s`)
  - `COOKIE_EXPIRES_IN` - cookie max age in milliseconds (optional)
  - `COOKIE_DOMAIN` - optional cookie domain for production

Other env values may be used for mail configuration or OAuth credentials (Google), see `src/modules/mail` and `src/modules/auth/google-oauth20`.

## Installation & first run

1. Install dependencies:

```bash
pnpm install
```

2. Prepare database and `.env`.

3. (Optional) Use TypeORM CLI scripts in `package.json` to run migrations or sync schema while developing:

```bash
# create a migration
pnpm run migration:generate -- <Name>

# run migrations
pnpm run migration:run

# sync schema (development only)
pnpm run schema:sync

# drop schema (development only)
pnpm run schema:drop
```

> Note: `synchronize: true` is enabled in `src/infrastructure/persistence/typeorm.config.ts` for development convenience. Disable in production and use migrations.

## Running the app

- Development (watch):

```bash
pnpm run dev
```

- Start (compiled):

```bash
pnpm run build
pnpm run prod
```

## Scripts

Key scripts available in `package.json`:

- `dev` — starts Nest in watch mode
- `build` — compiles TypeScript
- `prod` — runs compiled app
- `schema:sync`, `schema:drop`, `migration:generate`, `migration:run` — TypeORM CLI helpers
- `test`, `test:e2e`, `test:watch` — Jest tests

## Testing

Run unit tests:

```bash
pnpm run test
```

Run end-to-end tests:

```bash
pnpm run test:e2e
```

## Authentication

- Authentication uses JSON Web Tokens (JWT) signed using `JWT_SECRET` and stored as an HTTP-only cookie named `token` (and a non-httpOnly `isLoggedIn` cookie). The `JwtGuard` expects the cookie `token` to be present.
- JWT payload uses `sub` to store the user id. When you need the current user's id in controller handlers, the `@CurrentUser()` decorator returns the full `user` object attached by the `JwtGuard` to the request. Use `user.id`.

Endpoints (Auth):

- `POST /auth/register` — body: `{ name, email, password }` -> sets cookies and returns `{ ok, message, data: null }`
- `POST /auth/login` — body: `{ email, password }` -> sets cookies
- `POST /auth/logout` — clears cookies
- `POST /auth/forgot-password` — request reset magic link
- `POST /auth/reset-password` — reset password using token
- `GET /auth/google` and `GET /auth/google/callback` — Google OAuth endpoints

All protected endpoints require the `token` cookie. `JwtGuard` reads it and attaches the `User` entity to `request.user`.

## API Reference (selected)

All authenticated endpoints require a valid `token` cookie. Use `@CurrentUser()` to obtain current user in controllers.

- Modules

  - `POST /modules` — create module
    - Request body (application/json):
      - `title` (string, required)
      - `description` (string, optional)
      - `isPrivate` (boolean, optional)
    - Returns:
      ```json
      {
        "ok": true,
        "message": "Module created successfully",
        "data": {
          "id": "...",
          "title": "Module Title",
          "description": "Description of the module",
          "isPrivate": true,
          "userId": "..."
        }
      }
      ```
  - `GET /modules` — list modules with optional query params: `page`, `limit`, `genre`, `author`, `title`, `userId`
  - `GET /modules/:id` — get module by id
  - `PATCH /modules/:id` — update module
  - `DELETE /modules/:id` — delete module

- Terms

  - `POST /terms` — create term (body depends on `CreateTermDto`)
  - `GET /terms` — list terms (filters: `status`, `isStarred`, `moduleId`)
  - `GET /terms/:id`, `PATCH /terms/:id`, `DELETE /terms/:id` — CRUD
  - `POST /terms/update-status/:id` — update status for a term

- Users
  - `GET /users/me` — current user
  - `PATCH /users/me` — update current user
  - `PATCH /users/me/change-password` — change password
  - `DELETE /users/me` — delete user

For full request/response shapes consult the DTO files in `src/modules/*/dtos` and the controllers which annotate responses using `@ApiResponse` and `@ApiBody`.

## DTOs and Responses

- The controllers use `class-transformer`'s `plainToInstance(..., { excludeExtraneousValues: true })` with response DTOs (e.g. `ModuleResponseDto`) to serialize entities into the public API shape. Edit DTOs in `src/modules/*/dtos` to change API output.

Example shape for `ModuleResponseDto`:

```json
{
  "id": "14260e06-5834-4a09-99bc-a211cfd9f49d",
  "title": "Module Title",
  "description": "Description of the module",
  "isPrivate": true,
  "userId": "d9dd19cf-5dbb-4b25-aa4b-61ebee6f33ea"
}
```

## Troubleshooting

- Error: `QueryFailedError: null value in column "userId" of relation "module" violates not-null constraint`

  - Cause: The created entity did not include `userId` when saving. Fix: ensure the service attaches the authenticated user id to the created module (`{ ...createModuleDto, userId }`) or populate `userId` in DTO before saving.

- If the `@CurrentUser()` decorator prints `undefined` for the current user, check:
  - The `token` cookie is present in the request.
  - `JWT_SECRET` in `.env` matches the one used when creating the token.
  - `JwtGuard` is applied to the route (or globally).

## Contributing

1. Fork the repo
2. Create a feature branch
3. Add tests for new behavior
4. Open a pull request

Please follow existing linting rules (`pnpm run lint`) and formatting conventions (`pnpm run format`).

## Contact

If you need help with setup or want me to generate more targeted docs (e.g., full OpenAPI export, Postman collection, or examples), tell me what you want and I will add it.
