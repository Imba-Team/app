# Authentication

This document is the operating manual for the `mimir-server` authentication system. It covers every endpoint, every cookie, every Redis key, every env var, and every cryptographic choice — in enough depth that an engineer joining the team can understand, debug, or extend the system without reading the source.

> Audience: backend engineers, frontend engineers integrating the auth flow, on-call.
> Sprint reference: Sprint 2 (Roadmap §7), tasks 1–9.

---

## 1. At a glance

| Concern | Implementation |
|---|---|
| Password hashing | **bcrypt** (cost 10) |
| Access token | **RS256 JWT** in HttpOnly cookie `token`, 15-minute TTL |
| Refresh token | **Opaque 32-byte random**, hashed (sha-256) and stored in DB, in HttpOnly cookie `refresh_token` (`path=/auth/refresh`), 30-day TTL |
| Refresh model | **Single-use rotation** with **replay detection** that revokes the entire token family |
| Email verification | Magic link queued through **BullMQ → SendGrid** (or SMTP fallback), 24h TTL |
| Password reset | Same magic-link plumbing, 15min TTL |
| Login lockout | **Redis-backed**, 5 fails → 15-min cooldown, **fail-open** on Redis outage |
| Per-route throttle | NestJS `@Throttle()` decorators, 3–30 req/min per IP depending on endpoint |
| OAuth | Google via `passport-google-oauth20`, silently links to existing email accounts |
| Module hierarchy | `AuthModule` (controllers, AuthService, MagicLinkService, LoginAttemptsService, GoogleStrategy), depends on `MailModule`, `QueueModule`, `RedisModule`, `PrismaModule` |

---

## 2. Module structure

```
src/
├── modules/auth/
│   ├── auth.controller.ts                # /auth/* HTTP routes
│   ├── auth-health.controller.ts         # /services/auth/health
│   ├── auth.module.ts                    # wires the JwtModule + providers
│   ├── auth.service.ts                   # core logic: login / refresh / register / verify / forgot
│   ├── magic-link.service.ts             # purpose-aware one-time tokens
│   ├── login-attempts.service.ts         # Redis-backed lockout
│   ├── google-oauth20/
│   │   └── google.strategy.ts            # Passport Google strategy
│   └── dtos/                             # request bodies
├── common/jwt/
│   └── key-loader.ts                     # RSA key resolution
├── common/redis/
│   └── redis.module.ts                   # singleton ioredis client
├── common/queue/
│   └── queue.module.ts                   # BullMQ + `mail` queue
├── common/mail/
│   ├── mail.module.ts
│   ├── mail.service.ts                   # SendGrid / SMTP / NOOP
│   ├── mail-queue.service.ts             # producer (enqueue)
│   └── mail.processor.ts                 # worker (consume)
└── guards/
    ├── jwt.guard.ts                      # reads `token` cookie, verifies, attaches `req.user`
    └── google.guard.ts                   # AuthGuard('google')
```

---

## 3. Endpoint reference

All routes live under `/auth`. Rate limits are per IP unless noted. Auth requirements are at the route level — `JwtGuard` is opt-in (not global).

| Method | Path | Body | Auth | Rate limit | Description |
|---|---|---|---|---|---|
| POST | `/auth/register` | `{ username, email, password }` | none | 5 / min | Create unverified user, dispatch verification email, **no session cookie** |
| POST | `/auth/verify-email` | `{ token }` | none | 10 / min | Flip `emailVerified=true` for the user that owns the token |
| POST | `/auth/resend-verification` | `{ email }` | none | 3 / min | Re-dispatch verification email; always 200 (anti-enumeration) |
| POST | `/auth/login` | `{ email, password }` | none | 5 / min | Issue access + refresh + hint cookies on success |
| POST | `/auth/refresh` | — | refresh cookie | 30 / min | Rotate refresh token; issue new access + refresh pair |
| POST | `/auth/logout` | — | refresh cookie (optional) | default | Revoke active refresh-token family; clear cookies |
| POST | `/auth/forgot-password` | `{ email }` | none | 3 / min | Queue password-reset magic link; always 200 |
| POST | `/auth/reset-password` | `{ token, password, confirmPassword }` | none | 10 / min | Consume token, set new password, **revoke every active refresh token for the user** |
| GET | `/auth/google` | — | none | default | Redirect to Google consent |
| GET | `/auth/google/callback` | — | none | default | Resolve / link / create user, issue session |

### Common response shape

```json
{ "ok": true|false, "message": "human string", "data": null | { ... } }
```

Errors include a `code` field for programmatic handling:

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Email and password mismatch (covers both unknown email and wrong password) |
| `EMAIL_NOT_VERIFIED` | 403 | Valid credentials but verification still pending |
| `ACCOUNT_LOCKED` | 429 | Too many failed attempts; includes `retryAfterSeconds` |
| `REFRESH_MISSING` | 401 | No refresh cookie on `/auth/refresh` |
| `REFRESH_INVALID` | 401 | Refresh token unknown or expired |
| `REFRESH_REPLAY` | 401 | Replayed refresh token — **entire token family revoked** |
| `INVALID_TOKEN` | 400 | Magic-link token unknown / expired / wrong purpose |
| `GOOGLE_LINK_CONFLICT` | 409 | Another Google id is already linked to this email |

---

## 4. Cookies

Three cookies are set by the auth layer. All have `SameSite` and `Secure` derived from `NODE_ENV` — `lax` + non-secure in dev (works on localhost over HTTP), `none` + secure in production (cross-origin SPAs over HTTPS).

| Name | TTL | HttpOnly | Path | Carrier |
|---|---|---|---|---|
| `token` | 15 min | ✓ | `/` | RS256 JWT access token. Read by `JwtGuard`. |
| `refresh_token` | 30 days | ✓ | `/auth/refresh` | Opaque random 32-byte refresh token, base64url-encoded. Browser sends it **only** on `/auth/refresh` — minimises CSRF surface. |
| `isLoggedIn` | 30 days | ✗ | `/` | Plain `"true"` hint flag for the FE to know whether to show "Log in" or "Log out" buttons without exposing the actual token. |

---

## 5. Cryptography

### 5.1 Access token — RS256

The JwtModule is configured asynchronously from env via `loadJwtKeyPair()` ([key-loader.ts](../src/common/jwt/key-loader.ts)). Resolution order:

| Step | Env vars | When to use |
|---|---|---|
| 1. Raw PEM | `JWT_PRIVATE_KEY` + `JWT_PUBLIC_KEY` | Containerised env-injection that preserves newlines |
| 2. Base64 PEM | `JWT_PRIVATE_KEY_BASE64` + `JWT_PUBLIC_KEY_BASE64` | Secret managers that mangle newlines (most of them) |
| 3. File paths | `JWT_PRIVATE_KEY_PATH` + `JWT_PUBLIC_KEY_PATH` | Mounted secret files (Kubernetes, ECS) |
| 4. Ephemeral | none | **Dev-only.** Logs a loud warning; sessions invalidate on every restart |

The token payload is intentionally minimal — `{ sub: userId }`. Claims like `iss`, `iat`, `exp` are added by `JwtModule` based on its sign options (`algorithm: 'RS256'`, `expiresIn: JWT_ACCESS_TTL`, `issuer: JWT_ISSUER`).

Generate a key pair locally:

```bash
mkdir -p ./keys
openssl genrsa -out ./keys/jwt-private.pem 2048
openssl rsa -in ./keys/jwt-private.pem -pubout -out ./keys/jwt-public.pem

# point env at them
export JWT_PRIVATE_KEY_PATH=./keys/jwt-private.pem
export JWT_PUBLIC_KEY_PATH=./keys/jwt-public.pem
```

### 5.2 Refresh token — opaque + DB-backed

Refresh tokens are NOT JWTs. They are 32 random bytes (`crypto.randomBytes(32).toString('base64url')`). The raw value goes to the client cookie; only the sha-256 hex digest is persisted in `refresh_token.tokenHash`.

Why not a JWT for refresh?
- Revocation requires DB state anyway (single-use enforcement, replay detection, password-change invalidation).
- Once you accept DB state, JWT buys you nothing — and opaque tokens leak no payload data on log/error capture.

### 5.3 Password hashing

`bcrypt` cost 10 (`bcrypt.hash(password, 10)`). [Industry guidance has moved toward 12 for new systems](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html); making this env-configurable (`BCRYPT_ROUNDS`) is on the post-MVP backlog.

---

## 6. Flows

### 6.1 Register → verify → log in (email + password)

```
Client                       BE                                Mail worker        SendGrid/SMTP
  │                          │                                       │                  │
  │ POST /auth/register      │                                       │                  │
  ├─────────────────────────►│                                       │                  │
  │                          │ users.create (bcrypt hash)             │                  │
  │                          │ magicLink.send(EMAIL_VERIFICATION)     │                  │
  │                          │   ├ INSERT magic_link                  │                  │
  │                          │   └ mailQueue.enqueue ────────────────►│                  │
  │ 202 + { email }          │                                       │ MailProcessor    │
  │◄─────────────────────────┤                                       │ deliver ─────────►│
  │                          │                                       │                  │
  │      [user reads email,  │                                       │                  │
  │      clicks link → FE]   │                                       │                  │
  │                          │                                       │                  │
  │ POST /auth/verify-email  │                                       │                  │
  │  { token }               │                                       │                  │
  ├─────────────────────────►│ magicLink.verifyToken                  │                  │
  │                          │ user.update { emailVerified: true }    │                  │
  │ 200                      │                                       │                  │
  │◄─────────────────────────┤                                       │                  │
  │                          │                                       │                  │
  │ POST /auth/login         │                                       │                  │
  ├─────────────────────────►│ loginAttempts.assertNotLocked          │                  │
  │                          │ bcrypt.compare                         │                  │
  │                          │ issueSession → access + refresh        │                  │
  │ 200 + Set-Cookie ×3      │                                       │                  │
  │◄─────────────────────────┤                                       │                  │
```

### 6.2 Calling protected endpoints

The `JwtGuard` reads `req.cookies.token`, calls `authService.verifyToken(token)` (RS256 verify with the public key), looks up the user, and attaches them to `req.user`. Routes need an explicit `@UseGuards(JwtGuard)` — the guard is not global.

### 6.3 Refresh

```
Client                       BE
  │                          │
  │ POST /auth/refresh       │ (browser auto-sends refresh_token cookie because path matches)
  ├─────────────────────────►│
  │                          │ readRefreshCookie → raw
  │                          │ sha256 → tokenHash
  │                          │ find refresh_token row
  │                          │
  │                          │ ── if missing → 401 REFRESH_INVALID
  │                          │ ── if revokedAt set → REPLAY: revoke entire family → 401 REFRESH_REPLAY
  │                          │ ── if expired → 401 REFRESH_INVALID
  │                          │
  │                          │ issue new refresh_token (same familyId, parentId=old.id)
  │                          │ UPDATE old row { revokedAt: now, replacedByTokenId: new.id }
  │                          │ issue new access_token
  │ 200 + Set-Cookie ×3      │
  │◄─────────────────────────┤
```

Replay detection is the canonical "rotation detected" pattern: a previously-rotated token presented again can only come from an attacker (or a buggy client that didn't drop the old token after the first refresh). Either way, the safe move is to invalidate the whole chain and force re-authentication.

### 6.4 Google OAuth

```
Client            BE                  Google
  │                │                    │
  │ GET /auth/google                    │
  ├──────────────►│ AuthGuard('google') │
  │ 302 to Google                       │
  │◄──────────────┤                     │
  │                                     │
  │  ─── user consents on Google ──────►│
  │                                     │
  │ 302 back to /auth/google/callback   │
  │                                     │
  │ GET /auth/google/callback           │
  ├────────────────────────────────────►│
  │                BE: GoogleStrategy.validate({ id, email, name, picture })
  │                BE: authService.resolveGoogleUser
  │                     ├─ providerId match → reuse user
  │                     ├─ email match      → silently link Google to existing account
  │                     └─ neither          → create user (emailVerified=true, placeholder password)
  │                BE: issueSession + setSessionCookies
  │ 200 + Set-Cookie ×3                │
  │◄────────────────────────────────────┤
```

Linking policy notes:
- **Silent link** when an email-only account already exists. Justification: Google itself verified the email, so the user demonstrably controls it.
- **`409 GOOGLE_LINK_CONFLICT`** if a different Google subject is already linked to this email — never silently overwrite a link.

### 6.5 Password reset

Same magic-link plumbing as email verification, but with `MagicLinkPurpose.FORGOT_PASSWORD` (15min TTL). On successful `reset-password`:

1. Password updated in DB.
2. **Every active refresh token for the user is revoked.** Credential rotation invalidates every existing session — any other browser stays logged in until next request hits the now-failing refresh.
3. Response always uniform regardless of whether the email exists (anti-enumeration on `/auth/forgot-password`).

### 6.6 Logout

Reads `refresh_token` cookie, finds the row, revokes the entire family (if not already), clears all three cookies. Bare `/auth/logout` calls without a cookie are tolerated and just clear cookies.

---

## 7. Login lockout (per-account, Redis)

[`LoginAttemptsService`](../src/modules/auth/login-attempts.service.ts) implements the spec literally: **5 consecutive failed logins → 15-minute lockout** per email. Tunable via `LOGIN_MAX_ATTEMPTS` and `LOGIN_LOCKOUT_MINUTES`.

### State model

Two Redis keys per email (lowercased + trimmed):

| Key | Purpose | TTL |
|---|---|---|
| `login:fail:<email>` | Sliding-window counter (INCR + EXPIRE each failure) | `LOGIN_LOCKOUT_MINUTES` |
| `login:lock:<email>` | Lock marker (`SET key "1" EX <seconds>`) | `LOGIN_LOCKOUT_MINUTES` |

The lock key is the source of truth that gates login. The counter exists only to decide *when* to set the lock.

### What counts as a failure?

| Outcome | Counter increments? | Why |
|---|---|---|
| Unknown email | ✓ | Prevent enumeration via lockout timing |
| Wrong password | ✓ | Credential failure |
| Correct password, email not verified | ✗ | Auth is correct, gating is a separate concern |
| Correct password, verified | resets counter | Clean slate |

### Fail-open on Redis outage

Every method catches Redis errors and logs WARN. If Redis is down, login goes through — the per-IP throttler still bounds the surface (5 login attempts per minute per IP). Fail-closed would create a full availability incident the moment Redis hiccups, which is strictly worse for users than a brief degradation in brute-force resistance.

---

## 8. Throttling (per-IP, in-memory)

[`ThrottlerModule`](../src/app.module.ts) is registered globally with one default throttler (`100 req/min/IP`). Auth-sensitive endpoints opt into stricter limits using `@Throttle({ default: { limit, ttl } })`:

| Tier (constant) | Limit | Applied to |
|---|---|---|
| `RATE_LOGIN` | 5 / min | `/auth/login` |
| `RATE_REGISTER` | 5 / min | `/auth/register` |
| `RATE_REFRESH` | 30 / min | `/auth/refresh` |
| `RATE_TOKEN_CONSUME` | 10 / min | `/auth/verify-email`, `/auth/reset-password` |
| `RATE_MAIL_DISPATCH` | 3 / min | `/auth/forgot-password`, `/auth/resend-verification` |
| (default) | 100 / min | everything else |

`ThrottlerGuard` is registered as `APP_GUARD` — without that, the throttler module is configuration-only and doesn't actually reject anything.

### Defence in depth

The login surface has two independent layers:

1. **Per-IP throttle** — 5 attempts/min. Stops obvious flood.
2. **Per-account lockout** — 5 fails / 15min. Stops distributed credential stuffing where an attacker uses many IPs against one account.

---

## 9. Asynchronous mail dispatch (BullMQ + SendGrid)

Verification, reset, and (future) other transactional mail go through BullMQ so the HTTP request returns immediately and SendGrid outages don't break user flows.

```
AuthService / MagicLinkService
       │
       │ mailQueue.enqueue({ to, subject, html, context })
       ▼
   Redis queue: `mail`
       │
       ▼
 MailProcessor (in-process worker, concurrency MAIL_QUEUE_CONCURRENCY)
       │
       │ mailService.deliver(payload)
       ▼
 ┌────────────────────────────┐
 │ Transport selection:       │
 │  SENDGRID_API_KEY ─► SendGrid HTTP API   (prod)
 │  MAIL_HOST        ─► nodemailer SMTP     (dev, Mailpit)
 │  otherwise        ─► NOOP with WARN      (CI / no email)
 └────────────────────────────┘
```

### Retry policy

Configured in [queue.module.ts](../src/common/queue/queue.module.ts):

| Setting | Value | Meaning |
|---|---|---|
| `attempts` | 5 | Try at most 5× before dead-lettering |
| `backoff` | exponential, 1s base | 1s, 2s, 4s, 8s, 16s between retries |
| `removeOnComplete` | 24h / 1k jobs | Keep recent successes for observability |
| `removeOnFail` | 7d / 5k jobs | Keep failures for debugging |

If the transport returns false (config issue) or throws (5xx, timeout), BullMQ moves the job to `delayed` and reschedules. After attempts exhaust, it lands in `failed` and stays for 7 days.

`MailQueueService.stats()` exposes counts for `waiting / active / delayed / failed / completed` — useful when the `/services/notification/mail/stats` endpoint is wired up.

---

## 10. Configuration reference

### Required for production

| Env var | Default | Notes |
|---|---|---|
| `JWT_PRIVATE_KEY` or `JWT_PRIVATE_KEY_BASE64` or `JWT_PRIVATE_KEY_PATH` | — | Pick exactly one. Falling through to ephemeral is a **boot warning**, not a hard fail |
| `JWT_PUBLIC_KEY` or `JWT_PUBLIC_KEY_BASE64` or `JWT_PUBLIC_KEY_PATH` | — | Same |
| `JWT_ISSUER` | `mimir-api` | Embedded in `iss` claim and verified on every request |
| `JWT_ACCESS_TTL` | `15m` | Access token TTL — match cookie `maxAge` |
| `JWT_REFRESH_TTL_DAYS` | `30` | Refresh token TTL — drives DB row `expiresAt` and refresh cookie `maxAge` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `localhost:6379` / no password | Shared with BullMQ + LoginAttempts |
| `SENDGRID_API_KEY` | empty | Set to use SendGrid; unset to fall back to SMTP |
| `MAIL_FROM` (or legacy `NO_REPLY_MAIL`) | `no-reply@mimir.local` | Required for any actual delivery |
| `FRONTEND_BASE_URL` | `http://localhost:5173` | Used to build `verify-email` / `reset-password` link URLs |

### Tunable knobs

| Env var | Default | Effect |
|---|---|---|
| `LOGIN_MAX_ATTEMPTS` | `5` | Failures before lockout |
| `LOGIN_LOCKOUT_MINUTES` | `15` | Lockout window |
| `DEFAULT_THROTTLE_LIMIT` | `100` | Global per-IP req/min |
| `DEFAULT_THROTTLE_TTL_SECONDS` | `60` | Sliding window length for the default throttler |
| `MAIL_QUEUE_CONCURRENCY` | `5` | Parallel mail jobs per worker |
| `BCRYPT_ROUNDS` | hardcoded 10 | Not yet env-driven; backlog |

### Dev / CI

| Env var | Default | Effect |
|---|---|---|
| `NODE_ENV` | `development` | When `production` flips `SameSite=none` + `Secure=true` on cookies and switches the logger to JSON |
| `SERVICE_NAME` | `monolith` | Tag on metrics + logs |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | empty | Required only if Google sign-in is exercised — strategy boots with placeholders when missing so dev still works |

### Deprecated

| Env var | Replaced by |
|---|---|
| `JWT_SECRET` | `JWT_PRIVATE_KEY` + `JWT_PUBLIC_KEY` (RS256) |
| `JWT_EXPIRES_IN` | `JWT_ACCESS_TTL` |

---

## 11. Security model

| Threat | Mitigation |
|---|---|
| Credential stuffing | Per-account lockout (Redis) + per-IP throttle (Throttler) |
| Brute-force password | Same — defence in depth |
| Token theft via XSS | All session cookies are HttpOnly; FE has no access to `token` or `refresh_token` |
| Token replay | Single-use refresh tokens; replay revokes the entire family |
| CSRF on `/auth/refresh` | Refresh cookie has `path=/auth/refresh` so it's never sent on other endpoints; `SameSite=lax` (dev) / `none` + Secure (prod) |
| Email enumeration via response codes | Unknown email and wrong password both return identical `401 INVALID_CREDENTIALS`; forgot-password / resend-verification always 200 |
| Email enumeration via timing | Both branches do equivalent work (DB lookup + counter increment) |
| Magic-link tampering | Tokens are random + DB-checked + purpose-scoped + TTL-bound |
| Stolen verification link | Single-use (token deleted on first consumption); 24h TTL |
| Compromised credentials propagated to other sessions | Password reset revokes every active refresh token for the user |
| Compromised Redis | Lockout fails open — degraded brute-force resistance, not full outage |
| Stale RS256 key | Key rotation is a deploy: replace `JWT_PRIVATE_KEY` and restart — every existing access token instantly invalidates; refresh tokens are unaffected since they're opaque |

### Known security gaps (Sprint 2 close)

- **Pre-existing TODO** in `src/guards/jwt.guard.ts` to migrate to `passport-jwt` strategy. Functionally equivalent today; the refactor is mostly hygiene.
- **`BCRYPT_ROUNDS`** not env-driven (hardcoded 10). Backlog item to bump to 12 for new hashes while keeping the existing ones working.
- **No 2FA / TOTP.** Roadmap defers to v1.5.
- **No CAPTCHA** on signup. Rate limiter is the only signal today; revisit if bot signups become an issue post-launch.

---

## 12. Operating runbook

### Local dev — first-time setup

```bash
# 1. Infra
docker compose up -d                    # postgres, redis, elasticsearch, minio, clickhouse
pnpm prisma migrate deploy              # apply all migrations

# 2. Keys (optional but recommended — otherwise sessions invalidate on each restart)
mkdir -p ./keys
openssl genrsa -out ./keys/jwt-private.pem 2048
openssl rsa -in ./keys/jwt-private.pem -pubout -out ./keys/jwt-public.pem
cat >> .env <<'EOF'
JWT_PRIVATE_KEY_PATH=./keys/jwt-private.pem
JWT_PUBLIC_KEY_PATH=./keys/jwt-public.pem
EOF

# 3. App
pnpm dev
```

For local email delivery, run Mailpit:

```bash
docker run -d --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
# Open http://localhost:8025 to read every email the app dispatches
```

### Smoke-testing the auth flow

```bash
# Register
curl -X POST http://localhost:9090/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"jane","email":"jane@test.com","password":"hunter22"}'
# → 202 + { email }
# Mailpit shows a "Verify your Mimir email" message; copy the token from the link

# Verify
curl -X POST http://localhost:9090/auth/verify-email \
  -H 'Content-Type: application/json' \
  -d '{"token":"PASTE-HERE"}'
# → 200

# Login
curl -i -X POST http://localhost:9090/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@test.com","password":"hunter22"}' \
  -c cookies.txt
# → 200 + Set-Cookie: token, refresh_token, isLoggedIn

# Refresh
curl -i -X POST http://localhost:9090/auth/refresh -b cookies.txt -c cookies.txt
# → 200 + new Set-Cookie token + refresh_token

# Logout
curl -i -X POST http://localhost:9090/auth/logout -b cookies.txt
# → 200 + cleared cookies
```

### Probing a stuck account (production)

```bash
redis-cli -h <REDIS_HOST> get login:lock:<email>      # "1" if locked
redis-cli -h <REDIS_HOST> ttl login:lock:<email>      # seconds remaining
redis-cli -h <REDIS_HOST> get login:fail:<email>      # current counter
```

To force-unlock (manual unstick, e.g. for a known good user):

```bash
redis-cli -h <REDIS_HOST> del login:lock:<email> login:fail:<email>
```

### Auditing a refresh family

Each rotation chain shares a `familyId`. To inspect:

```sql
SELECT id, "parentId", "createdAt", "revokedAt", "userAgent", "ipAddress"
FROM   refresh_token
WHERE  "familyId" = '<uuid>'
ORDER  BY "createdAt";
```

A row with `revokedAt` set and `replacedByTokenId` pointing at another row in the same family = normal rotation. A row with `revokedAt` set and no `replacedByTokenId` = explicit revoke (logout / password reset / replay). Multiple rows revoked at the same instant with no replacements = **family killed due to replay** — that's the signal an attacker presented a stolen token.

### Forcing global token rotation

Replace `JWT_PRIVATE_KEY` (and `_PUBLIC_KEY`) and restart. Every existing access token instantly fails verification. Refresh tokens are opaque and unaffected — the very next request hits `/auth/refresh`, gets a fresh access token, and the user never notices. This makes RS256-key rotation safe to do during maintenance windows.

---

## 13. Testing

31 unit tests live alongside the services and run via `pnpm exec jest`:

| Suite | Coverage |
|---|---|
| [`src/common/jwt/key-loader.spec.ts`](../src/common/jwt/key-loader.spec.ts) | Each loader branch + precedence + invalid-base64 fallback |
| [`src/modules/auth/login-attempts.service.spec.ts`](../src/modules/auth/login-attempts.service.spec.ts) | `assertNotLocked` / `recordFailure` / `recordSuccess` (incl. **fail-open on Redis outage**) |
| [`src/modules/auth/auth.service.spec.ts`](../src/modules/auth/auth.service.spec.ts) | `login` (all 5 branches), `rotateRefreshToken` (incl. **replay detection**), `verifyEmail`, `register`, `resolveGoogleUser` (incl. cross-provider conflict) |

The suites use plain `jest.fn()` mocks — no `Test.createTestingModule({...})` — so they run in ~3 seconds and don't touch Postgres / Redis. Path resolution for `src/...` imports is handled by Jest `moduleNameMapper` in `package.json`.

To run only the auth suites:

```bash
pnpm exec jest src/modules/auth src/common/jwt
```

### Integration / e2e gaps

Out of scope for the unit pass. Future work:
- Integration tests with the real Postgres + Redis from `docker-compose` (covered in Sprint 4+).
- Playwright e2e for the full register → verify → login → refresh → logout flow (Sprint 12 / Roadmap §7).

---

## 14. Future work

Tracked as backlog beyond Sprint 2:

| Item | Sprint | Why |
|---|---|---|
| Migrate `JwtGuard` to `passport-jwt` strategy | Polish | Code hygiene; equivalent behaviour today |
| `BCRYPT_ROUNDS` env-configurable | Polish | Production hardening |
| Stronger password policy (length, HIBP check) | Polish | OWASP guidance |
| `/services/notification/mail/stats` Prometheus gauge | Sprint 11 (notifications) | Observability — `MailQueueService.stats()` is already implemented |
| TOTP / WebAuthn | v1.5 | Roadmap §3.1 deferred |
| Apple OAuth (backend only) | Phase 2 | iOS app dependency |
| Account recovery via support tooling | Phase 2 | Operator process not yet defined |
| Refresh-token Prisma rate-limit (defence against burst-rotate) | Backlog | Per-family rotation rate cap |

---

## 15. References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [JWT RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519)
- [RFC 8725 — JWT Best Current Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [`@nestjs/jwt`](https://docs.nestjs.com/security/authentication)
- [`@nestjs/throttler`](https://docs.nestjs.com/security/rate-limiting)
- [`@nestjs/bullmq`](https://docs.nestjs.com/techniques/queues)
- [`passport-google-oauth20`](https://www.passportjs.org/packages/passport-google-oauth20/)
- [ioredis](https://github.com/redis/ioredis)
