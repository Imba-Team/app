#!/usr/bin/env bash
# Sync frontend API types from the backend's OpenAPI-generated types.
#
# In the monorepo the backend produces the canonical types offline via
# `pnpm --filter @mimir/server openapi`. This script re-runs that and copies
# the result into apps/web/src/lib/api/generated/api-types.ts.
#
# Usage:
#   pnpm generate:api-types          # regenerate + overwrite
#   pnpm generate:api-types:check    # CI mode: fail if the committed file drifts

set -euo pipefail

MODE="write"
if [[ "${1:-}" == "--check" ]]; then
  MODE="check"
elif [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

WEB_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_TYPES="${WEB_ROOT}/../server/generated/api-types.ts"
OUT_DIR="${WEB_ROOT}/src/lib/api/generated"
OUT_FILE="${OUT_DIR}/api-types.ts"

mkdir -p "${OUT_DIR}"

echo "Regenerating backend OpenAPI spec + types..."
pnpm --filter @mimir/server openapi >/dev/null

if [[ ! -f "${SERVER_TYPES}" ]]; then
  echo "ERROR: backend types not found at ${SERVER_TYPES}" >&2
  exit 2
fi

if [[ "${MODE}" == "check" ]]; then
  if diff -u "${OUT_FILE}" "${SERVER_TYPES}"; then
    echo "OK: ${OUT_FILE} matches backend types."
    exit 0
  else
    echo "" >&2
    echo "ERROR: ${OUT_FILE} is out of sync with the backend OpenAPI spec." >&2
    echo "       Run 'pnpm generate:api-types' locally and commit the result." >&2
    exit 1
  fi
fi

cp "${SERVER_TYPES}" "${OUT_FILE}"
echo "Types synced to ${OUT_FILE}"
