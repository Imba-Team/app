# mimir-web

Mimir's web frontend — Vite + React 18 SPA.

Talks to the backend (`mimir-backend`, NestJS modular monolith) via HTTP + OpenAPI-generated types.

## Structure

```
frontend-v2/
├── src/
│   ├── main.tsx             # entry (added in F3)
│   ├── App.tsx              # root component (F3)
│   ├── routes/              # React Router route tree (F3)
│   ├── features/            # feature-scoped screens (F3)
│   ├── components/          # design-system UI (F3)
│   └── lib/                 # framework-agnostic shared code
│       ├── api/             # axios client, JWT/refresh, generated OpenAPI types, auth hooks
│       ├── design-tokens/   # colors, spacing, typography, motion
│       ├── i18n/            # i18next setup + 7 locale bundles
│       ├── study/           # mastery reducer + XState machines
│       └── utils/           # Zod schemas, date + format helpers
├── scripts/
│   └── generate-api-types.sh
├── package.json
├── tsconfig.json
├── vite.config.ts           # (F3)
└── ...
```

## Requirements

- Node.js ≥ 20.10 (see `.nvmrc`)
- pnpm ≥ 9 (see `packageManager` field in `package.json`)

## Getting started

```sh
pnpm install
pnpm dev                     # Vite dev server (needs F3)
pnpm test                    # Vitest
pnpm type-check              # tsc --noEmit
pnpm build                   # production bundle
```

## Backend link

Types are generated from the backend's OpenAPI spec (`/api/docs-json`).

```sh
# Backend must be reachable — defaults to http://localhost:3000
pnpm generate:api-types

# Or point at staging
BACKEND_STAGING_URL=https://staging.api.mimir.app pnpm generate:api-types
```

Generated files land in [src/lib/api/generated/](src/lib/api/generated/) and are committed to the repo.

## Reference

- **TDD v1.4** ([Mimir_TDD_v1.md](Mimir_TDD_v1.md)) — technical decisions, module boundaries, deployment.
- **SRS v1.0** ([Mimir_SRS_v1.docx](Mimir_SRS_v1.docx)) — product requirements.
