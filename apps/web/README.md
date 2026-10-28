## Mimir web (`@mimir/web`)

The Mimir frontend: create and organise study sets, and study them with flashcards, Learn, Write, Test and spaced-repetition review. It talks to the NestJS API in [`apps/server`](../server) using cookie-based auth.

### What you can do

- Sign up / log in (email + password or Google), verify email, reset password.
- Create study sets (public or private), add, edit, star and import cards (paste or CSV).
- Organise sets into folders; save other people's public sets to your library.
- Study with Flashcards, Learn (with matching warm-ups), Write and Test; review due cards on `/srs`.
- Track streaks, activity, mastery and retention on `/progress`; browse public sets on `/discover`.
- Comment on sets; manage profile, preferences, sessions and account in `/account`.

### Quick start

Run from the repo root (pnpm workspace):

```bash
pnpm install
pnpm dev:web          # next dev on http://localhost:3000 (WEB_PORT)
# or `pnpm dev` to run the API and web together
```

The API origin comes from `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:9090`, see [`lib/env.ts`](lib/env.ts)). Requests are sent with credentials, so keep cookies enabled.

Useful scripts: `pnpm --filter @mimir/web lint`, `type-check`, `build`, and `generate:api-types` (regenerates the OpenAPI types from the server).

### Stack

- Next.js 16 (App Router), React 19, TypeScript.
- Tailwind CSS v4 with shadcn/ui (Radix) components and lucide-react icons.
- Forms with React Hook Form + Zod; data fetching with TanStack Query over Axios.
- API types generated from the server's OpenAPI spec (`lib/api/generated.ts`).

### Structure

- `app/` – routes (auth, dashboard, library, discover, modules and study modes, srs, progress, account); route-private components in `_components/`.
- `components/` – shared components; `components/ui/` is the shadcn kit.
- `contexts/` – React contexts (auth, create-module dialog).
- `lib/` – API client and types, TanStack Query hooks, auth helpers, env.
- `public/` – static assets.

### Deployment

`pnpm --filter @mimir/web build`, then `pnpm --filter @mimir/web start`. The hosting target for the web app hasn't been chosen yet (the API deploys to Render via [`render.yaml`](../../render.yaml)).
