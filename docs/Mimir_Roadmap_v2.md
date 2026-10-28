# Mimir — Development Roadmap v2

> **Version:** 2.0.0 | **Supersedes:** Roadmap v1 (removed; see git history) as the current execution plan
> **Baseline:** State of `main` as of the current gap review (see companion analysis)
> **Reference architecture:** [Mimir_TDD_v1.md](Mimir_TDD_v1.md)

This roadmap starts from what is **already shipped** and sequences the remaining TDD scope into two-week sprints, prioritised by MVP-blocking vs polish.

---

## 0. Status — 2026-10-28

The live backlog is in Linear (team **Mimir**, key `MIM`), grouped into ordered projects: Stability & quality → Library & set editing → Notifications & reminders → Sharing & community → Account & auth → Later / platform. This section records where each sprint below stands; the sections after it are the original plan, kept for context.

| Sprint | Status | Notes |
|---|---|---|
| 1 — SRS live | ✅ Done, except reminder delivery | `/srs` queue, review, forecast, Learn→SRS graduation, `srs-reminders` scheduler. The reminder job only logs until notifications exist (MIM-43, blocked by MIM-16). |
| 2 — Library & Discover | ✅ Mostly done | `/library`, `/library/folders/[id]`, `/discover`, `/sets/[id]/edit`. Public sets come from `GET /study-sets/public` and `GET /search/sets` (not `/sets/public`). No counter columns: card/save counts are computed when the search document is rebuilt, which every relevant write now triggers (MIM-45). Open: editor completion (MIM-44), tag editing (MIM-37), Discover filters/sort (MIM-50), Unlisted (MIM-32). |
| 3 — Write mode | ✅ Done | `/modules/[id]/write` (MIM-19). Matching ships as a warm-up step inside Learn (MIM-20) instead of a standalone Match mode. |
| 4 — Auth + i18n + profile | 🟡 Partly done | Done: RS256 keys, `displayName`/`timezone`/`preferredLanguage`, sessions list + revoke (pulled in from Sprint 12), login lockout with `retryAfterSeconds`. Open: Apple sign-in (MIM-23), log out everywhere (MIM-25), i18n (MIM-27). |
| 5–6 — AI + set export | ⏸ AI postponed | AI generation and AI study modes (MIM-12/13/14) are parked in Backlog. Set export (MIM-21) not started. |
| 7 — Notifications | ⬜ Not started | MIM-16, then MIM-43. |
| 8 — Classroom | ⬜ Not started | MIM-15 (after collaboration, MIM-18). |
| 9 — Analytics | 🟡 Partly done | `/progress` (streaks, activity, mastery history, retention), dashboard stats strip and all-time session totals (MIM-17/55/56/57) — built on Postgres + nightly snapshots, not ClickHouse. |
| 10 — Hardening | 🟡 In progress | Done: comments UI (MIM-36), migration baseline + CI check (MIM-54), input hygiene (MIM-49), search count sync (MIM-45). Open: dependency health checks (MIM-48). |
| 11 — Polish A | ⬜ Mostly open | Mail already supports Resend, SendGrid and SMTP. Open: set versions (MIM-28), user search (MIM-29). |
| 12 — Polish B | 🟡 Partly done | Sessions list + revoke done. Open: data export (MIM-26). |

---

## 1. Baseline — what was in place when this plan was written

**Backend ([apps/server](../apps/server))**
- Auth core: register / login / refresh rotation / verify / reset / magic link / Google OAuth ([auth.controller.ts](../apps/server/src/modules/auth/auth.controller.ts))
- Users, Study Sets, Folders, Tags, Favourites, Comments; collaborators as a data model only (no endpoints or UI yet — MIM-18)
- Card import (CSV / text) via [set-flashcards.controller.ts](../apps/server/src/modules/flashcard/set-flashcards.controller.ts)
- Learning sessions end-to-end: `applyAttempt`, write evaluator with Levenshtein, per-set progress ([learning/](../apps/server/src/modules/learning/))
- SM-2 algorithm + unit tests ([sm2.ts](../apps/server/src/modules/srs/domain/sm2.ts)) — HTTP surface added in Sprint 1
- Elasticsearch sync for sets, `GET /search/sets`
- BullMQ queues: `mail`, `search-sync`
- Monitoring stack: Prometheus + Grafana + Loki + Promtail ([monitoring/](../monitoring/))

**Web ([apps/web](../apps/web))** — Next.js App Router
- Routes: `/`, `/dashboard`, `/account`, `/login`, `/register`, `/modules`, `/modules/new`, `/modules/[id]`, `/modules/[id]/learn`, `/modules/[id]/flashcards`, `/modules/[id]/test`, `/modules/[id]/sessions`
- Axios client with refresh interceptor; access and refresh tokens are both HttpOnly cookies (`token`, `refresh_token`)

**Architectural divergences from TDD v1 (accepted as-is)**
- Single NestJS app instead of 9-microservice split (TDD §3.2). Module boundaries preserved inside the monolith.
- Next.js App Router instead of Vite SPA (TDD §11.1).

---

## 2. Gap inventory (rolled into sprints below; see §0 for current status)

**MVP-blocking**
1. AI module (flashcard generation, Fill-Blank, Guess Word)
2. SRS HTTP surface + daily queue + forecast + scheduler + Learning→SRS graduation
3. Classroom domain (classes, memberships, assignments, results)
4. Notifications + Socket.io real-time
5. Set export (CSV / PDF / Anki)
6. Study-mode UIs: Write, Match, AI Fill-Blank, AI Guess Word
7. Web routes: `/library`, `/library/folders/[id]`, `/discover`, `/classroom`, `/classroom/[id]`, `/progress`, `/profile/[username]`, `/sets/[id]/edit`
8. i18n plumbing (confirmed missing — MIM-27)
9. Apple OAuth (open — MIM-23), RS256 JWT keypair (✅ done)
10. User profile fields: `displayName`, `preferredLanguage`, `timezone` (✅ done)

**Polish / edge**
11. SetVersion model + versions module
12. SendGrid provider
13. ClickHouse analytics pipeline
14. User autocomplete search index (`mimir_users`, edge-ngram)
15. Multi-device sessions list + revoke (✅ done)
16. Data export endpoints (Sprint 1b deferred)
17. StudySet counter columns (`cardCount`, `viewCount`, `likeCount`) — only `viewCount` became a column; card/save counts are kept fresh in the search index instead (MIM-45)
18. Flashcard `synonyms`, `translations`
19. BullMQ queues: `push-notification`, `srs-reminders`, `set-export`, `analytics-events`
20. Search: `mimir_users` index + autocomplete endpoint

---

## 3. Release plan

| Release | Contents | Target |
|---|---|---|
| **v0.9 (Alpha)** | Sprints 1–4 — SRS live end-to-end, Library, Write/Match modes, i18n, auth completion | +8 weeks |
| **v0.95 (Closed Beta)** | Sprints 5–7 — AI module + AI study modes, set export, notifications | +14 weeks |
| **v1.0 (MVP GA)** | Sprints 8–10 — Classroom, analytics, hardening | +20 weeks |
| **v1.1** | Sprints 11–12 — versions, SendGrid, autocomplete, polish backlog | +24 weeks |

---

## 4. Sprint plan

Two-week sprints. Each sprint lists **Backend**, **Web**, **Exit criteria**. Owners omitted — assign at planning.

### Sprint 1 — SRS goes live (weeks 1–2)

**Backend**
- Add SRS HTTP surface on [srs.controller.ts](../apps/server/src/modules/srs/srs.controller.ts): `GET /srs/queue/today`, `POST /srs/cards/:id/review`, `GET /srs/forecast?days=30` (TDD §8.3, §8.4).
- Wire Learning → SRS graduation: on `applyAttempt` graduate event, upsert `SrsCard` (TDD §8a.6).
- BullMQ queue `srs-reminders` + nightly cron scheduler to bucket due cards per user timezone (TDD §15.3).

**Web**
- `/srs` route showing today's queue and forecast chart.
- Session-complete screen surfaces "N cards graduated to SRS."

**Exit:** A user finishing a Learn session sees graduated cards appear in `/srs` the next day; `/srs/forecast` returns non-empty for a seeded account.

---

### Sprint 2 — Library & Discover (weeks 3–4)

**Backend**
- Public discovery endpoint (`GET /sets/public` with filters, pagination, sort by popularity).
- Add StudySet counter columns `cardCount`, `viewCount`, `likeCount` with backfill migration; increment via existing view/favourite paths.

**Web**
- `/library` — user's sets + folders combined view with filter chips.
- `/library/folders/[id]` — folder detail.
- `/discover` — browse public sets, driven by `/sets/public`.
- `/sets/[id]/edit` — full editor (title, description, visibility, cards, tags).

**Exit:** Library and Discover routes ship with filtering, pagination, and empty states; editor round-trips changes.

---

### Sprint 3 — Study modes: Write (weeks 5–6)

**Backend**
- No new endpoints — Write already uses `/sessions/:id/answer-written`.
- Idempotency review on `SETNX` keys per TDD §8a.5.

**Web**
- `/modules/[id]/write` — typed-answer mode using existing write evaluator.
- Update module home page to expose the mode.

**Exit:** Write mode is playable, sessions complete cleanly, attempt logs written.

---

### Sprint 4 — Auth completion + i18n + profile fields (weeks 7–8)

**Backend**
- Apple OAuth strategy in [auth/](../apps/server/src/modules/auth/) (mirror Google strategy shape).
- Rotate JWT signing to RS256 keypair; add `JWT_PUBLIC_KEY` / `JWT_PRIVATE_KEY` env, keep HS256 fallback for one release.
- `POST /auth/logout-all` (revoke entire refresh-token family).
- Prisma migration: add `displayName`, `preferredLanguage`, `timezone` to User; extend `PATCH /users/me` DTO.

**Web**
- Confirm i18n state (grep shows no `useTranslation` currently). If missing: install `next-intl`, extract strings on `/login`, `/register`, `/dashboard`, `/modules/*`, seed `en` + `ru` + `az` catalogs.
- Apple sign-in button + callback route wired to backend.
- Profile section fields for language + timezone.

**Exit:** Language switcher works across implemented routes; Apple login round-trips; new access tokens verify against public key.

**➡️ v0.9 Alpha release cut here.**

---

### Sprint 5 — AI module foundation (weeks 9–10)

**Backend**
- Anthropic client + `AiGenerationService` in [ai/](../apps/server/src/modules/ai/).
- `POST /ai/generate-flashcards` (TDD §9) — input text/topic, returns candidate cards.
- `AiGeneration` Prisma model for audit + reuse.
- `AiRateLimiterService` (per-user daily quota, Redis-backed).
- Prompt caching enabled per Claude API best practices.

**Web**
- "Generate with AI" flow in `/modules/new` — paste source, preview cards, accept-to-set.

**Exit:** A learner can create a set of ≥20 cards from pasted text in one round trip; quotas enforced.

---

### Sprint 6 — AI study modes + Set export (weeks 11–12)

**Backend**
- `POST /ai/fill-blank/:setId` and `POST /ai/guess-word/:setId` — produce mode-specific prompts on demand, cached per card.
- `POST /sets/:id/export?format=csv|anki|pdf` → enqueue `set-export` BullMQ job → upload to MinIO → return signed URL when ready.
- New queue `set-export`; MinIO bucket wiring for `exports/`.

**Web**
- `/modules/[id]/ai-fill-blank`, `/modules/[id]/ai-guess-word`.
- Export dropdown on set detail page with polling for job completion.

**Exit:** Both AI modes run a full session; export produces a downloadable file for each format.

---

### Sprint 7 — Notifications + real-time (weeks 13–14)

**Backend**
- Socket.io gateway (TDD §16) — connection auth via JWT, per-user room.
- `Notification` Prisma model + REST endpoints (`GET /notifications`, `POST /notifications/:id/read`).
- BullMQ `push-notification` queue; SRS scheduler emits reminders through it.
- FCM integration (optional — behind flag if credentials not ready).

**Web**
- Notifications bell in header; real-time toast on new notification.
- SRS reminder deep-links to `/srs`.

**Exit:** Reminder generated at scheduled time is visible in the UI within 2s of emission.

**➡️ v0.95 Closed Beta cut here.**

---

### Sprint 8 — Classroom (weeks 15–16)

**Backend**
- Prisma: `Class`, `ClassMembership`, `Assignment`, `AssignmentResult` (TDD §5.1.3).
- Endpoints: create/list classes, invite/join by code, create assignment (bind to set + due date), submit result, teacher roster + progress view.
- Notification hooks: assignment created / due soon / result submitted.

**Web**
- `/classroom` list, `/classroom/[id]` detail with roster + assignments tabs.
- Student assignment inbox on `/dashboard`.

**Exit:** Teacher creates a class, assigns a set with a due date, students see it, teacher sees per-student progress.

---

### Sprint 9 — Analytics pipeline (weeks 17–18)

**Backend**
- ClickHouse client wiring; schemas for `attempt_events`, `session_events`, `set_events`.
- BullMQ `analytics-events` queue fanning out from Learning + SRS + Set modules.
- `GET /analytics/me/progress` reads from ClickHouse for per-user progress rollups.

**Web**
- `/progress` route: streaks, retention curve, mastery over time.

**Exit:** Progress page renders real per-user metrics from ClickHouse; event lag < 5s p95.

---

### Sprint 10 — Hardening + MVP launch prep (weeks 19–20)

**Backend**
- Load test to TDD SLOs (100k CCU headroom, p95 < 300ms).
- Full audit of rate limits, idempotency, and error taxonomy.
- k8s manifests + CI rollout gate (if not already).

**Web**
- `/profile/[username]` public profile.
- Empty-state, error-state, and offline-state pass across every route.
- Accessibility audit (WCAG AA on primary flows).

**Exit:** MVP GA candidate; go/no-go review.

**➡️ v1.0 MVP GA release.**

---

### Sprint 11 — Post-GA polish A (weeks 21–22)

- **SetVersion** model + versions module + rollback endpoint.
- **SendGrid** provider swap for transactional mail.
- User autocomplete search (`mimir_users` ES index, edge-ngram, `GET /search/users`).
- Flashcard `synonyms String[]` and `translations Json?` columns + editor UI.

---

### Sprint 12 — Post-GA polish B (weeks 23–24)

- Multi-device sessions list + revoke (Sprint 1b deferred) — ✅ shipped early.
- Data export endpoints + BullMQ job.
- Additional locales: fill out `es`, `de`, `fr`.
- Backlog cleanup: any `mimir_users` gaps, remaining StudySet fields (`languageFrom/To`, `category`, `isArchived`, `aiGenerated`).

---

## 5. Cross-cutting workstreams

Run in parallel with feature sprints, not on the critical path:

- **DX & CI:** OpenAPI spec regen on merge; type sync into web; e2e Playwright suite kept green each sprint.
- **Observability:** each new module ships a Grafana panel + alert rule before it counts as done.
- **Docs:** update [Mimir_TDD_v1.md](Mimir_TDD_v1.md) inline when architecture drifts (versioning, single-monolith reality, etc.).

---

## 6. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| AI cost blowup once real users hit `/ai/generate-flashcards` | High | Per-user quotas + prompt caching in Sprint 5; cost dashboard in Sprint 9 |
| ClickHouse operational overhead | Medium | Defer to Sprint 9; keep event schema minimal; single-shard for MVP |
| i18n retrofit larger than expected | Medium | Sprint 4 confirms scope early; can slip stub locales to Sprint 12 |
| Notifications delivery guarantees | Medium | Persist to DB first, deliver via Socket.io as best-effort, FCM as follow-up |
| Sprint-1b auth deferrals stale-blocking | Low | Batched into Sprint 4 and Sprint 12 explicitly, not left floating |

---

## 7. Definition of done (applies to every sprint)

- Unit tests for pure domain functions; integration tests for endpoints.
- OpenAPI regenerated; web types synced.
- Grafana panel + at least one alert for new module.
- No regression in existing Playwright suite.
- i18n keys added for every new user-facing string (once i18n plumbing lands in Sprint 4).
- CHANGELOG entry.
