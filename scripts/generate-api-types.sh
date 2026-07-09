#!/usr/bin/env bash
# Regenerate TypeScript types from the backend's OpenAPI spec.
#
# Usage:
#   BACKEND_STAGING_URL=https://staging.api.mimir.app pnpm generate:api-types
#
# Defaults to http://localhost:3000 if BACKEND_STAGING_URL is not set.

set -euo pipefail

SPEC_URL="${BACKEND_STAGING_URL:-http://localhost:3000}/api/docs-json"
OUT_DIR="src/lib/api/generated"
OUT_FILE="${OUT_DIR}/api-types.ts"

mkdir -p "${OUT_DIR}"

echo "Fetching OpenAPI spec from ${SPEC_URL}..."
pnpm exec openapi-typescript "${SPEC_URL}" --output "${OUT_FILE}"
echo "Types generated at ${OUT_FILE}"
