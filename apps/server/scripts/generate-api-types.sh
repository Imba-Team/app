#!/usr/bin/env bash
#
# generate-api-types.sh
#
# End-to-end OpenAPI type pipeline:
#   1. Bootstraps the Nest application offline and writes an OpenAPI 3 spec.
#   2. Converts that spec into a single-file TypeScript `paths`/`components` definition
#      consumable by the frontend (openapi-fetch / tanstack-query / etc.).
#
# Output:
#   generated/openapi.json   — canonical OpenAPI 3 spec
#   generated/api-types.ts   — TypeScript types
#
# Exit codes:
#   0 on success
#   non-zero if either step fails
#
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

OUT_DIR="${OUT_DIR:-generated}"
SPEC_FILE="${SPEC_FILE:-$OUT_DIR/openapi.json}"
TYPES_FILE="${TYPES_FILE:-$OUT_DIR/api-types.ts}"

mkdir -p "$OUT_DIR"

echo "[1/2] Generating OpenAPI spec  → $SPEC_FILE"
OPENAPI_OUT="$SPEC_FILE" pnpm exec ts-node \
  --transpile-only \
  -P tsconfig.json \
  -r tsconfig-paths/register \
  scripts/generate-openapi.ts

echo "[2/2] Generating TypeScript types → $TYPES_FILE"
pnpm exec openapi-typescript "$SPEC_FILE" \
  --output "$TYPES_FILE" \
  --root-types \
  --alphabetize

echo "✓ Done. Spec: $SPEC_FILE  Types: $TYPES_FILE"
