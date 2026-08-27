# OpenAPI Type Pipeline

This document describes how the OpenAPI 3 specification and TypeScript types are produced, why they're committed to git, and how the frontend consumes them.

> Audience: anyone touching controllers, DTOs, or the frontend integration layer.

---

## 1. What gets produced

Two artifacts live under [`generated/`](../generated/) and are committed to git:

| File | Purpose | Consumed by |
|---|---|---|
| [`generated/openapi.json`](../generated/openapi.json) | OpenAPI 3.0 specification — the canonical contract of the API | Anyone (Postman, Insomnia, Stoplight, FE codegen, other backends) |
| [`generated/api-types.ts`](../generated/api-types.ts) | One-file TypeScript `paths` + `components.schemas` types | The `mimir-web` frontend |

Both are byte-for-byte deterministic — same source code produces the same output. CI relies on that to catch stale artifacts.

---

## 2. Pipeline overview

```
┌──────────────────────────────┐
│  src/**/*.controller.ts      │  ① decorators describe routes
│  src/**/*.dto.ts             │      and request / response shapes
│  (@ApiOperation, etc.)       │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  scripts/generate-openapi.ts │  ② boots Nest in process (no HTTP listen)
│  └─ SwaggerModule            │      reads decorators, builds the document
│       .createDocument()      │
└──────────────┬───────────────┘
               │
               ▼
        generated/openapi.json    ③ written to disk
               │
               ▼
┌──────────────────────────────┐
│  openapi-typescript          │  ④ converts JSON spec → TS types
└──────────────┬───────────────┘
               │
               ▼
        generated/api-types.ts    ⑤ written to disk
               │
               ▼
┌──────────────────────────────┐
│  mimir-web (frontend)        │  ⑥ imports `paths` / `components`
│  + openapi-fetch             │      → end-to-end type safety
└──────────────────────────────┘
```

Three commands, in increasing scope:

| Command | What it does |
|---|---|
| `pnpm run openapi:spec` | Just regenerate `generated/openapi.json` |
| `pnpm run openapi:types` | Just regenerate `generated/api-types.ts` (assumes spec is current) |
| `pnpm run openapi` | Run both (the canonical command) |
| `pnpm run openapi:check` | Run both, then `git diff --exit-code generated/` — used by CI |

---

## 3. How the NestJS side describes the API

`@nestjs/swagger` is already wired into the project. Every controller or DTO that should appear in the spec must be annotated. The pipeline only sees what the decorators expose.

### 3.1 Annotating a controller

```ts
import { Controller, Post, Body } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateStudySetDto } from './dto/create-study-set.dto';
import { StudySetResponseDto } from './dto/study-set-response.dto';

@ApiTags('study-sets')           // groups routes in the spec
@ApiBearerAuth()                 // declares JWT auth on every route below
@Controller('study-sets')
export class StudySetController {
  @Post()
  @ApiOperation({
    summary: 'Create a study set',
    description: 'Returns the created study set with its flashcards.',
  })
  @ApiCreatedResponse({ type: StudySetResponseDto })
  create(@Body() dto: CreateStudySetDto): Promise<StudySetResponseDto> {
    // ...
  }
}
```

### 3.2 Annotating a DTO

`@ApiProperty` is the contract between the source class and the generated schema. Without it, the field appears with a permissive `any` type.

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, IsEnum } from 'class-validator';
import { StudySetVisibility } from '@prisma/client';

export class CreateStudySetDto {
  @ApiProperty({
    example: 'GRE vocabulary — week 1',
    minLength: 1,
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  title: string;

  @ApiProperty({ enum: StudySetVisibility, default: 'PRIVATE' })
  @IsEnum(StudySetVisibility)
  visibility: StudySetVisibility;

  @ApiProperty({
    description: 'Two-letter ISO language code',
    example: 'en',
    pattern: '^[a-z]{2}$',
  })
  @IsString()
  language: string;
}
```

### 3.3 Reference (most-used decorators)

| Decorator | Use it for |
|---|---|
| `@ApiTags('group')` | Group endpoints in the spec sidebar |
| `@ApiOperation({ summary, description })` | One-line + long-form description |
| `@ApiOkResponse({ type: Dto })` | 200 response body |
| `@ApiCreatedResponse({ type: Dto })` | 201 response body |
| `@ApiNoContentResponse()` | 204 response |
| `@ApiBadRequestResponse({ description })` | 400 error |
| `@ApiUnauthorizedResponse()` | 401 |
| `@ApiForbiddenResponse()` | 403 |
| `@ApiNotFoundResponse()` | 404 |
| `@ApiBearerAuth()` | Marks routes as needing a JWT bearer |
| `@ApiCookieAuth('jwt')` | Marks routes as needing a JWT cookie |
| `@ApiQuery({ name, type, required })` | Query params (or rely on class-validator on a query DTO) |
| `@ApiParam({ name, type })` | Path params |
| `@ApiProperty({ ... })` | DTO field |
| `@ApiPropertyOptional({ ... })` | Optional DTO field — same as `@ApiProperty({ required: false })` |

---

## 4. The generator script

[`scripts/generate-openapi.ts`](../scripts/generate-openapi.ts)

```ts
const app = await NestFactory.create(AppModule, {
  logger: ['warn', 'error'],
  abortOnError: false,
});

const config = new DocumentBuilder()
  .setTitle('Mimir API')
  .setDescription('...')
  .setVersion(process.env.npm_package_version ?? '0.0.0')
  .addBearerAuth()
  .addCookieAuth('jwt')
  .addServer('http://localhost:9090', 'Local development')
  .build();

const document = SwaggerModule.createDocument(app, config);
writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n', 'utf8');
await app.close();
```

Key production choices:

| Choice | Rationale |
|---|---|
| `NestFactory.create(...)` *without* `app.listen()` | No HTTP port binding — safe in CI, won't collide with other processes |
| `abortOnError: false` | Spec generation succeeds even if a non-fatal `ConfigModule` warning is raised |
| `logger: ['warn', 'error']` | Suppresses the long route-mapping log spam in CI output |
| `JSON.stringify(doc, null, 2)` | 2-space indent + trailing newline → diff-friendly |
| `await app.close()` | Releases Prisma connection + open handles so the process exits cleanly |
| `process.env.OPENAPI_OUT` override | CI can redirect to a temp file when verifying |
| `npm_package_version` for the `version` field | Single source of truth — bump `package.json` and the spec follows |

The script is run via `ts-node` with `tsconfig-paths/register` so the existing `src/...` import style works without compiling first.

---

## 5. The shell wrapper

[`scripts/generate-api-types.sh`](../scripts/generate-api-types.sh)

```bash
OPENAPI_OUT="$SPEC_FILE" pnpm exec ts-node \
  --transpile-only \
  -P tsconfig.json \
  -r tsconfig-paths/register \
  scripts/generate-openapi.ts

pnpm exec openapi-typescript "$SPEC_FILE" \
  --output "$TYPES_FILE" \
  --root-types \
  --alphabetize
```

`openapi-typescript` flags chosen for the frontend:

| Flag | Effect |
|---|---|
| `--root-types` | Emits top-level `Schemas` alias → FE writes `Schemas['UserResponseDto']` instead of `components['schemas']['UserResponseDto']` |
| `--alphabetize` | Sorts properties → byte-deterministic output, safe for git diff |

Override the output paths with env vars: `OUT_DIR`, `SPEC_FILE`, `TYPES_FILE`.

---

## 6. Why the artifacts are committed

We chose to commit `generated/` rather than `.gitignore` it. Trade-offs:

| Pros (committed) | Cons (committed) |
|---|---|
| Frontend can branch from `main` and get types without booting backend | PR diffs are bigger when contracts change |
| Git history shows when the API contract changed and who changed it | Merge conflicts on `generated/` are possible when two PRs change unrelated endpoints |
| Tools that don't run Node (e.g. Postman) can grab a tagged version | Slightly slower clone |
| CI detects "you changed a controller but forgot to regenerate" instantly | Discipline required: contributors must run `pnpm run openapi` before pushing |

The CI guard in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`pnpm run openapi:check`) makes the "forgot to regenerate" failure mode loud and obvious.

---

## 7. Frontend usage (mimir-web)

The single-file `generated/api-types.ts` works with any HTTP client. The recommended pairing is [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/):

```ts
// frontend code (illustrative — lives in mimir-web)
import createClient from 'openapi-fetch';
import type { paths } from '@mimir/api-types';

export const api = createClient<paths>({ baseUrl: 'http://localhost:9090' });

const { data, error } = await api.GET('/users/me');
//      ^? UserResponseDto                ^? ErrorDto

const { data: created } = await api.POST('/study-sets', {
  body: { title: 'Hello', visibility: 'PRIVATE', language: 'en' },
});
```

Path params, query params, request and response bodies are all type-checked at compile time. Renaming a backend field → frontend won't compile.

### Distribution options

1. **Copy** the file into the FE repo on each release (simple, no extra tooling)
2. **Publish** as a private `@mimir/api-types` package on npm/GitHub Packages (proper versioning, but more ceremony)
3. **Git submodule** (rarely worth it)

For MVP, option 1 is fine. Revisit once there's a second consumer.

---

## 8. Daily workflow

```bash
# 1. Edit a controller or DTO
vim src/modules/study-set/study-set.controller.ts

# 2. Regenerate (takes ~3 seconds)
pnpm run openapi

# 3. Stage and commit alongside the source change
git add src/ generated/

# 4. PR. CI verifies regenerate is a no-op.
```

If you forget step 2, CI fails with:

```
+++ b/generated/openapi.json
@@ -123,4 +123,8 @@
+    "/study-sets/:id/delete": {
+      ...
+    }
✗ openapi:check: generated/ is out of date
```

Fix locally → recommit → CI passes.

---

## 9. CI verification

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

```yaml
- name: Verify OpenAPI artifacts are up to date
  run: pnpm run openapi:check
```

That command re-runs the full pipeline and then `git diff --exit-code generated/`. Any difference between the regenerated output and the committed files is a failure.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module 'src/common/...'` | Running ts-node without the path mapping | Use `pnpm run openapi:spec` (already includes `-r tsconfig-paths/register`) |
| Spec is empty for a controller | Missing `@Controller(...)` decorator or controller not in any module | Add the controller to its module's `controllers: []` array |
| Field shows as `any` in `api-types.ts` | Missing `@ApiProperty` on the DTO field | Annotate the field |
| Enum field appears as `string` | Used `type: String` instead of `enum:` | `@ApiProperty({ enum: MyEnum })` |
| Polymorphic response (e.g. union) | OpenAPI doesn't support TS unions natively | Document each variant in a `@ApiExtraModels` + `oneOf` pattern, or pick one |
| CI fails with "generated/ is out of date" but nothing changed | Non-deterministic decorator order or env-dependent labels | Run `pnpm run openapi` locally on the same Node version as CI (20.x) |
| Two PRs both regenerate `generated/openapi.json` → merge conflict | Two independent contract changes | Resolve by regenerating on top of `main`: `git checkout main -- generated && pnpm run openapi` |

---

## 11. References

- [`@nestjs/swagger` docs](https://docs.nestjs.com/openapi/introduction)
- [OpenAPI 3.0 spec](https://swagger.io/specification/v3/)
- [`openapi-typescript`](https://openapi-ts.dev/)
- [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) — recommended FE runtime
