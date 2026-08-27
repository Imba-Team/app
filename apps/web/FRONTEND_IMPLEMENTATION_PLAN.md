# Mimir Web — Frontend Implementation Plan

> **Scope:** Phase 1 web frontend only (`mimir-web` / this repo). Backend (`mimir-backend`) is assumed feature-complete and exposing its OpenAPI spec at `/api/docs-json`. Native mobile is out of scope for this plan.
>
> **Sources:** [Mimir_SRS_v1.docx](Mimir_SRS_v1.docx) (functional/non-functional requirements, user stories US-001…US-050) and [Mimir_TDD_v1.md](Mimir_TDD_v1.md) §11 (frontend architecture) plus §6 (auth), §8 (SRS), §8a (Mastery Engine), §9 (AI), §13 (search), §17 (security).
>
> **Cadence:** 2-week sprints (per SRS Assumptions & Constraints). 11 delivery sprints + 1 stabilisation sprint after a 1-week Sprint 0 audit ≈ **6 months of frontend work**.

---

## 0. Baseline — what already exists in this repo

The scaffolding under [src/](src/) covers the skeletal layout described in TDD §11.1. Confirmed present:

- **Providers** — [src/providers/](src/providers/): `app-providers`, `auth-provider`, `query-provider`, `i18n-provider`.
- **Router shell** — [src/routes/router.tsx](src/routes/router.tsx) with stub routes for `/login`, `/register`, `/`, `/library`, `/sets/:setId`, `/sets/:setId/study/:mode`, `/classroom`, `/progress`, `/discover`, `/profile/:username`, `/demo`, `*`.
- **Layout chrome** — [src/components/layout/topbar.tsx](src/components/layout/topbar.tsx), [src/components/layout/sidebar.tsx](src/components/layout/sidebar.tsx).
- **UI kit** — ~20 shadcn/Radix primitives in [src/components/ui/](src/components/ui/) (button, input, card, tabs, dialog, select, radio-group, checkbox, switch, slider, tooltip, avatar, badge, progress, alert, separator, table, textarea, label, skeleton).
- **API layer** — [src/lib/api/client.ts](src/lib/api/client.ts), [src/lib/api/token-store.ts](src/lib/api/token-store.ts), generated types at [src/lib/api/generated/api-types.ts](src/lib/api/generated/api-types.ts), auth context at [src/lib/api/hooks/auth-context.tsx](src/lib/api/hooks/auth-context.tsx).
- **Design tokens** — colours/typography/spacing/motion in [src/lib/design-tokens/](src/lib/design-tokens/).
- **i18n** — resource loader + locale JSON stubs for `en`, `es`, `fr`, `de`, `ru`, `az` at [src/lib/i18n/](src/lib/i18n/). Product-side decision (see Sprint 0 item 6) is to ship this 6-locale set and drop the SRS-mandated `zh`/`ar`/`pt`.
- **Study primitives** — [src/lib/study/mastery.ts](src/lib/study/mastery.ts) (+ tests) and XState machines for `learn`, `write`, `srs` at [src/lib/study/machines/](src/lib/study/machines/). No mode components rendered yet.
- **One concrete feature** — [src/features/auth/login-form.tsx](src/features/auth/login-form.tsx).

**Stack deviations from TDD §11 to acknowledge:** the code uses **TanStack Query + React Context** for auth/user state, not Zustand as spec'd in TDD §11.1. Stick with the code's choice unless the team elects to add Zustand. Storybook (called out in TDD §12.4) is **not** installed — added as a Sprint 10 task.

**Backend contract sync:** every sprint that touches API-bound work starts with `pnpm run generate:api-types` (see [scripts/generate-api-types.sh](scripts/generate-api-types.sh)) so `components['schemas']` in [api-types.ts](src/lib/api/generated/api-types.ts) reflects the live spec.

---

## Sprint 0 — Foundations audit (1 week)

**Goal:** every subsequent sprint starts on a green baseline.

1. Regenerate API types against the live backend OpenAPI spec; commit and fail CI on drift.
2. Harden [src/lib/api/client.ts](src/lib/api/client.ts) — verify 401 refresh queue behaviour under concurrent requests (TDD §11.2). Add unit tests.
3. Install and wire **MSW** for browser + vitest so features can be built against realistic API doubles until integration tests take over.
4. Global UX plumbing:
   - Error boundary + fallback screen at the router root.
   - Toast/notification queue (shadcn `sonner` or `toaster`).
   - Standard loading skeletons + empty states.
   - 404 / offline / permission-denied templates in [src/routes/not-found.tsx](src/routes/not-found.tsx).
5. Confirm dark-mode token pipeline: verify Tailwind consumes [src/lib/design-tokens/](src/lib/design-tokens/), add `next-themes`-style theme switcher.
6. i18n: enable `i18next-browser-languagedetector` and split namespaces per feature (`auth`, `sets`, `study`, `srs`, `classroom`, `common`). **Deviation from SRS NFR-I18N-001:** launch locale set is `en`/`es`/`fr`/`de`/`ru`/`az` (already scaffolded) — SRS-mandated `zh`/`ar`/`pt` are dropped per product decision. Consequently, no RTL locales in Phase 1; RTL scaffolding stays as a no-op stub in case that reverses later.
7. CI baseline: enforce `lint`, `type-check`, `test`, `format:check`, and `generate:api-types --check` on every PR.

**Exit criteria:** clean CI on `main`; MSW-backed dev mode boots without a live backend; auth refresh queue proven under load in tests.

---

## Sprint 1 — Authentication & account management

**Requirements covered:** FR-AUTH-001…011, FR-PROF-001…003 · US-001, US-002, US-003, US-032.

**Deliverables**

1. Full **login** and **register** forms with `react-hook-form` + `zod` — email + password rules (8+, upper, digit, symbol), display-name, username uniqueness pre-check, TOS/GDPR consent (SRS §6.3).
2. **Forgot password** and **reset password** routes wired to `/auth/password/reset-request` and `/auth/password/reset`.
3. **Email verification** page consuming the token from the emailed link and calling `/auth/verify-email`; unverified accounts get a read-only banner.
4. **OAuth 2.0** buttons for Google and Apple (FR-AUTH-003); redirect handler route at `/auth/callback/:provider`.
5. **Account lockout UI** after 5 failed attempts (FR-AUTH-006) — countdown + support link.
6. **Multi-device sessions** view (FR-AUTH-005) — list active sessions, revoke individually.
7. **Settings → Account**: display name, avatar upload (signed-URL PUT to R2 per TDD §14), bio, `preferred_language`, timezone.
8. **Delete account** flow (FR-AUTH-010, US-032) with confirm-by-typing-username + confirmation email.
9. **Data export** (FR-AUTH-011) — request JSON archive, poll status, download when ready.
10. Harden the token store — HttpOnly refresh cookie on backend, access token in memory only (never `localStorage`).

**Definition of done:** all four AUTH user stories pass a Playwright happy-path; refresh-token rotation observable in the network tab; RBAC banner blocks study modes for unverified accounts.

---

## Sprint 2 — Library, study sets & cards

**Requirements covered:** FR-SET-001…010, FR-FOLD-001…004 · US-004, US-005, US-006, US-007, US-008, US-009, US-024, US-030.

**Deliverables**

1. **Library route** ([src/routes/library.tsx](src/routes/library.tsx)) — tabs for *My sets / Saved / Archived*; grid + list toggle; sort by recent / mastery / title.
2. **Folder tree** — nested up to 4 levels (FR-FOLD-001); drag-and-drop reorder; colour coding (FR-FOLD-003); shareable link (FR-FOLD-004). A set may live in multiple folders (FR-FOLD-002).
3. **Set detail** ([src/routes/set-detail.tsx](src/routes/set-detail.tsx)) — metadata, mastery %, per-mode CTA grid, card list preview, collaborator avatars, share, duplicate (US-008), archive, like/save (US-030).
4. **Set editor** — title, description, `language_from`/`language_to`, visibility (private/followers/public), tags (≤20), category.
5. **Card editor** — all fields from SRS §5.3.1: term (500ch), definition (2000ch, rich text), phonetic, example, synonyms (≤10 tag input), translations (JSON map, ≤5 langs), private notes.
6. **Import wizard** (FR-SET-009, US-006) — CSV / Excel / TSV upload → field-mapping preview → 100 cards in <5 s.
7. **Export** (FR-SET-010, US-007) — CSV, PDF, Anki `.apkg` with progress indicator.
8. **Version history** (FR-SET-007, US-009) — versions list, diff view, restore confirmation.
9. **Collaborators** (FR-SET-006, FR-COLLAB-001…003) — invite by email/username, viewer/editor/admin, change-log tab.
10. **Card limits** enforced client-side (2–10,000 per set, FR-SET-002) with server-side truth as fallback.

**Definition of done:** creating, editing, importing, and exporting a 100-card set works end-to-end. Version restore and duplicate flows are covered by integration tests.

---

## Sprint 3 — Flashcards mode

**Requirements covered:** FR-FLASH-001…006 · US-010, US-011, US-012.

**Deliverables**

1. **`SessionProvider`** ([src/features/study/](src/features/study/)) implementing the reducer from TDD §11.3 — `cards`, `currentIndex`, `correct`, `incorrect`, `sessionId`, `isComplete`. Wires `POST /sessions` on entry and `POST /sessions/:id/complete` on exit.
2. **`FlashcardsMode`** — 3D flip animation (350 ms, cubic-bezier per TDD §12.4), keyboard nav (arrow, space), shuffle, star, "Know it / Still learning" per-card marks (FR-FLASH-002), progress bar, first-side config (FR-FLASH-006).
3. **`AudioButton`** — visible on every card (FR-AUD-001); disabled with "TTS ships in v1.1" tooltip until §10 lands (per TDD §11.4 note). The button component and its speed toggle (0.5×/0.75×/1×/1.25×) are ready; the hook is stubbed.
4. Session results screen — accuracy, time, "Study weak cards" CTA.

**Definition of done:** Flashcards is fully keyboard-driven and touch-friendly. TTS button renders but doesn't call the API.

---

## Sprint 4 — Learn, Write, Test, Quiz modes

**Requirements covered:** FR-LRN-001…004, FR-WRITE-001…004, FR-TEST-001…006, FR-QUIZ-001…004 · US-013, US-014, US-016, US-038, US-050. **Spell Mode is deferred** — it requires the TTS pipeline that TDD §10/§11.4 defer to v1.1.

**Deliverables**

1. **Learn Mode** — drive [src/lib/study/machines/learn.machine.ts](src/lib/study/machines/learn.machine.ts). Batches of 7–10 (FR-LRN-001), mixed MC + written questions, confidence-score UI, mastery declared when ≥0.85 across 3+ correct (FR-LRN-003, mirrors mastery engine in TDD §8a). Resume-from-last-position via `sessionId` in URL (FR-LRN-004).
2. **Write Mode** — drive [src/lib/study/machines/write.machine.ts](src/lib/study/machines/write.machine.ts). Configurable matching (exact / case-insensitive / partial with Levenshtein tolerance, FR-WRITE-002); inline diff on incorrect (FR-WRITE-003); hint chip with score penalty (FR-WRITE-004).
3. **Test Mode** — auto-generated from set, ratios configurable (FR-TEST-002), optional timer 10–120 min, results screen with per-question analysis + time-per-question (FR-TEST-004), retake history graph (FR-TEST-005). Teachers can assign to a class (US-038, wired in Sprint 7).
4. **Quiz Mode** — manual quiz builder (Multiple choice single/multi, Open-ended, True/False, Fill-in-blank, Matching), Practice vs Assessment mode toggle (FR-QUIZ-003), shareable link + class assign hook.
5. Answer submission uses **`POST /sessions/:id/answer`** payload shape from TDD §8a.7; response drives the next-card render.

**Definition of done:** all four modes fully render, submit answers, and update card mastery. XState visualisations attached to each machine for QA.

---

## Sprint 5 — Spaced Repetition System

**Requirements covered:** FR-SRS-001…007 · US-018, US-019, US-020, US-046, US-048, US-049.

**Deliverables**

1. **SRS queue view** — driven by [src/lib/study/machines/srs.machine.ts](src/lib/study/machines/srs.machine.ts) and `GET /srs/queue`. Prioritised: overdue → due today → new (FR-SRS-003). Count badge on Dashboard (US-018).
2. **Rating UI** — Again / Hard / Good / Easy buttons wired to `POST /srs/review`; ease-factor and interval update animates in place (FR-SRS-006, US-019).
3. **30-day forecast** — bar chart consuming `GET /srs/forecast` (FR-SRS-005, US-020).
4. **SRS settings** in Settings screen — new-cards-per-day (default 10, FR-SRS-004, US-048), overdue-threshold for notifications.
5. **Leech view** — `is_leech = true` filter (FR-SRS-007, US-049) with a "Review as batch" CTA that starts a scoped Learn session.
6. **Weak-cards view** on Progress — sorted by accuracy ascending (US-046) with "Study now" starting an SRS session filtered to those card IDs.

**Definition of done:** completing an SRS session updates the 30-day forecast on refresh; leech tag becomes visible after 7 lapses; user-configured overdue threshold triggers the notification in Sprint 9.

---

## Sprint 6 — AI features

**Requirements covered:** FR-AI-001…017 · US-021, US-022, US-023.

**Deliverables**

1. **AI Flashcard Generation** wizard (US-021) — topic vs pasted-text input, `language_from`/`language_to` pickers, count (≤50), submit `POST /ai/generate/flashcards`. Show streaming progress; enforce the 8-second budget with a soft-warning UI beyond that (FR-AI-003).
2. **Editable preview** grid — accept/reject per card before persist (FR-AI-004). Saves to a new draft set.
3. **Daily generation quota UI** — remaining sets today, reset time (FR-AI-006).
4. **AI Fill-in-the-Blank Mode** (US-022) — `POST /sessions/:id/ai/fill-blank`, blank inline, typo-tolerant evaluation (Levenshtein ≤1 for 6+ char words, FR-AI-009). If backend times out at 3 s (FR-AI-011), fall back to Write Mode for that card automatically.
5. **AI Guess the Word Mode** (US-023) — description paragraph, single "Get Clue" button per card per session (FR-AI-015), guess input, typo-tolerant scoring.
6. **AI-powered badge** component (FR-AI-017) surfaced on every AI-generated content pane so users understand the dynamic-content nature.
7. **Cost telemetry hook** — surface an "AI generations used this week" line in Settings (data from `/ai/usage`).

**Definition of done:** a 50-card set generates in <8 s (SRS §6.1 target), and both AI study modes are playable through the SessionProvider without persistence side-effects.

---

## Sprint 7 — Classroom (teacher + student)

**Requirements covered:** FR-CLASS-001…009 · US-033, US-034, US-035, US-036, US-037, US-047.

**Deliverables**

1. **Teacher — Create class** (US-033) — form, auto-generated 6-char join code, copyable invite link.
2. **Class roster** — list students, remove (FR-CLASS-003), invite by link, class capped at 200 (FR-CLASS-002).
3. **Student — Join class** — flow accepting the join code from URL or manual entry.
4. **Assignment creation** (US-034, FR-CLASS-004) — pick a set or quiz, whole class or specific students, due date, mastery goal, allowed study modes.
5. **Assignments dashboards**:
   - **Student view**: assigned homework cards on the dashboard (SRS §12.2) with progress + deadline.
   - **Teacher view**: at-risk banner (48h not-started, FR-CLASS-007, US-035), real-time completion status, per-student score (FR-CLASS-006).
6. **Class analytics** (US-036, FR-CLASS-008) — class-average mastery, per-student progress bars, completion rates, time-on-task heatmap.
7. **Export class report** (US-037, FR-CLASS-009) — PDF and CSV downloads.
8. RBAC guard — routes and CTAs correctly hidden for non-teacher accounts (SRS §4.2).

**Definition of done:** a teacher can create a class, assign a set with a deadline, and see per-student mastery. Students see the assignment on their dashboard and complete it through the study modes built in Sprint 3–4.

---

## Sprint 8 — Social, search & discover

**Requirements covered:** FR-SEARCH-001…004, FR-SOC-001…004, FR-PROF-001…003, FR-COLLAB-001…003 · US-026, US-029, US-030, US-031, US-039, US-040, US-043, US-044.

**Deliverables**

1. **Discover route** ([src/routes/discover.tsx](src/routes/discover.tsx)) — trending, recommended feed, category browser, all served by `GET /discover` (public).
2. **Search** — full-text query bar with autocomplete <150 ms after 3rd char (FR-SEARCH-004), filters for source/target language, category, sort. Results <300 ms P95 (FR-SEARCH-002).
3. **Public profile** ([src/routes/profile.tsx](src/routes/profile.tsx)) — bio, sets, follower/following counts, 90-day contribution heatmap (FR-PROF-002, US-026), profile-visibility toggle (public/followers-only/private, FR-PROF-003).
4. **Social actions** (FR-SOC-001…004) — follow/unfollow, like, save-to-library (US-030), comment threads on public sets, block, report.
5. **Guest mode** (US-043) — public sets browsable without login; study CTAs push to registration.
6. **Content-creator flow** (US-039) — publishing UX from the set editor, "make public" preview.
7. **Collaboration surface** (US-040, US-044) — invite panel with viewer/editor/admin roles, change-log tab already stubbed in Sprint 2 gets its API integration here.

**Definition of done:** an unauthenticated visitor can search and preview a public set. A logged-in user can follow another user, save their set, and see it in Library.

---

## Sprint 9 — Notifications, real-time & learner analytics

**Requirements covered:** FR-NOTIF (§5.19), SRS §5.20.1, TDD §16 (Socket.io) · US-027, US-028, US-045, US-046.

**Deliverables**

1. **In-app notifications center** — dropdown from the topbar; groups by type (SRS ready, assignment created/due, security alert, weekly summary). Backed by `GET /notifications`.
2. **Preferences UI** for each notification row (channel + on/off), mapping SRS §5.19 table.
3. **Browser push registration** — service-worker registration + subscribe, VAPID key exchange with backend. Falls back gracefully when Notification API is denied.
4. **Daily study reminder** (US-027) — local-time picker, timezone honoured server-side.
5. **SRS overdue warning** (US-028) — triggered by user-threshold set in Sprint 5.
6. **Assignment reminders** (US-045) — 24h-before-deadline push + email counted client-side too.
7. **Socket.io client** (TDD §16) — connect on auth; subscribe to `notifications:*` and `collab:set:*` channels; drive live comment threads and live class dashboards.
8. **Learner analytics dashboard** ([src/routes/progress.tsx](src/routes/progress.tsx)) — mastery over time, accuracy by mode / by card / by language, retention estimate per set, 90-day activity heatmap, weak cards list. All backed by `GET /users/me/stats` + `/users/me/activity`.

**Definition of done:** enabling notifications delivers a real push; the SRS queue-ready threshold triggers correctly; the Progress dashboard renders every metric in SRS §5.20.1.

---

## Sprint 10 — i18n, accessibility & performance

**Requirements covered:** NFR-I18N-001…004, NFR-ACC-001…005, SRS §6.1 (Core Web Vitals).

**Deliverables**

1. **Full translation coverage** for every user-facing string across the 6 launch locales (`en`, `es`, `fr`, `de`, `ru`, `az` — see Sprint 0 item 6 for the deviation from SRS NFR-I18N-001). Enforce via a lint rule that fails on hardcoded strings (NFR-I18N-004).
2. **RTL support** — no RTL locale in Phase 1, so this reduces to keeping the `isRtl()` / `rtlLocales` scaffolding intact and re-verifying it wires correctly if a future sprint adds `ar`.
3. **Locale-aware formatting** — dates, numbers, durations via `Intl.*` (NFR-I18N-003).
4. **WCAG 2.1 AA audit**:
   - Focus order + visible focus rings on every interactive element (NFR-ACC-002).
   - `aria-label`/`aria-live` coverage across dynamic panes (session feedback, notification center, timer).
   - Screen-reader QA passes with **NVDA** (Win) and **VoiceOver** (macOS) per NFR-ACC-003.
   - Colour-contrast audit at 4.5:1 minimum (NFR-ACC-005) — automated via `axe-core` in CI.
   - Keyboard shortcuts documented and discoverable.
5. **Performance** — route-based code splitting audit, bundle-size budget in CI, first-contentful-paint <2.5 s (SRS §6.1), preload critical fonts (Inter, Poppins).
6. **Storybook** — install per TDD §12.4, stories for every `components/ui/*` primitive plus study-mode component states (idle/answering/correct/incorrect/complete). Publish as a Chromatic preview per PR.

**Definition of done:** axe CI is clean, Lighthouse ≥90 on Dashboard and Study routes, and every string across every screen renders correctly in `ar` (RTL) and `zh`.

---

## Sprint 11 — QA hardening & release readiness

**Requirements covered:** SRS §6 (all NFRs), TDD §17 (security), TDD §18.4 (E2E).

**Deliverables**

1. **Playwright E2E suite** for TDD §18.4 golden paths:
   - Register → verify → create set → import 100 cards → study Flashcards → complete session.
   - Login → SRS queue → rate 20 cards → forecast updates.
   - AI generate 50-card set → edit preview → save → study.
   - Teacher creates class → assigns quiz → student joins and completes.
2. **MSW-backed integration tests** for every API hook and the token-refresh queue.
3. **Security pass** (TDD §17):
   - CSP headers verified against the deployed frontend.
   - XSS-safe rich-text renderer for card definitions (DOMPurify).
   - `rel="noopener noreferrer"` audit on external links.
   - Confirm no tokens leak to `localStorage` or logs.
4. **Error monitoring** — Sentry (or equivalent) with release health + source maps upload in CI.
5. **Analytics events** — instrument key funnel steps (register, first-set-created, first-SRS-review, first-AI-generation) with a typed event schema.
6. **Deploy pipeline** — Cloudflare Pages (or Fly.io static site per stack lock-ins) with per-PR preview envs and a production promotion flow. Env vars documented in `.env.example` (already present) audited against actual usage.
7. **Release checklist** — a11y sign-off, i18n sign-off, security sign-off, performance sign-off, browser matrix (Chrome/Edge/Firefox/Safari; iOS Safari + Android Chrome) attached to the release ticket.

**Definition of done:** Playwright green on CI, Sentry receiving events from a preview deploy, and the production deploy pipeline demonstrated end-to-end on a release-candidate build.

---

## Cross-cutting rituals (every sprint)

- **`pnpm run generate:api-types`** at sprint start; PR blocked if schema drifted.
- **Storybook stories** for every new UI primitive (once Sprint 10 installs it, retroactively backfill).
- **New locale keys** added to all 7 launch locales in the same PR — never English-only.
- **A11y check** — keyboard + screen-reader smoke on each new screen before merge.
- **Bundle budget** — no PR increases the initial JS bundle by >5% without justification.
- **RBAC** — every route and CTA validated against the SRS §4.2 permission matrix; guests get preview-only, students can't access teacher tools, etc.

---

## Explicitly out of scope for Phase 1

The following are called out in SRS §2.2 / §14 and TDD §10 as **deferred**. Do not build in this repo without an explicit reversal:

- Gamification (XP, streaks, badges, leaderboards) — Phase 2.
- Premium subscription tier — Phase 2.
- Moderator role and moderation tooling — Phase 2.
- Full Administrator panel — Phase 2 (basic admin data lives on the backend only).
- **Spell Mode** and any TTS-driven audio behaviour — v1.1 (post-MVP per TDD §10, §11.4). The `AudioButton` component and speed controls ship in Sprint 3 as UI-only.
- Image support in cards — Phase 2.1.
- Offline mode / PWA install — Phase 2.1.
- AI tutor chat, study-plan generator, OCR/PDF import — Phase 2.1+.
- Native mobile app — separate repo, not this one.

---

## Timeline summary

| Sprint | Weeks | Focus |
|---|---|---|
| 0 | 1 | Foundations audit, MSW, missing locales, CI baseline |
| 1 | 2 | Auth, OAuth, account, GDPR flows |
| 2 | 2 | Library, sets, cards, import/export, versions, collab shell |
| 3 | 2 | Flashcards + Match; SessionProvider |
| 4 | 2 | Learn, Write, Test, Quiz |
| 5 | 2 | SRS queue, forecast, rating, leech/weak views |
| 6 | 2 | AI generation + Fill-in-the-Blank + Guess the Word |
| 7 | 2 | Classroom, assignments, teacher analytics |
| 8 | 2 | Discover, search, social, public profile |
| 9 | 2 | Notifications, Socket.io, learner analytics |
| 10 | 2 | i18n complete, WCAG AA, performance, Storybook |
| 11 | 2 | E2E hardening, security, release pipeline |

**Total:** ~23 weeks (≈6 months). Sequencing assumes the backend team stays a sprint ahead per module; if an endpoint slips, the affected feature slides forward, not the whole plan.
