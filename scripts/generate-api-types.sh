#!/usr/bin/env bash
# Regenerate TypeScript types from the backend's OpenAPI spec.
#
# Usage:
#   pnpm generate:api-types              # fetch + overwrite src/lib/api/generated/api-types.ts
#   pnpm generate:api-types:check        # CI mode: fail non-zero if committed file drifts
#   BACKEND_STAGING_URL=https://staging.api.mimir.app pnpm generate:api-types
#
# Env:
#   BACKEND_STAGING_URL   Backend base URL (default: http://localhost:3000)
#                         The script appends /api/docs-json.

set -euo pipefail

MODE="write"
if [[ "${1:-}" == "--check" ]]; then
  MODE="check"
elif [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

SPEC_URL="${BACKEND_STAGING_URL:-http://localhost:3000}/api/docs-json"
OUT_DIR="src/lib/api/generated"
OUT_FILE="${OUT_DIR}/api-types.ts"

mkdir -p "${OUT_DIR}"

# Fail fast with a readable message if the backend isn't reachable.
if ! curl -sSf -o /dev/null "${SPEC_URL}"; then
  echo "ERROR: could not fetch OpenAPI spec from ${SPEC_URL}" >&2
  echo "       Is the backend running? Set BACKEND_STAGING_URL to point at a live instance." >&2
  exit 2
fi

if [[ "${MODE}" == "check" ]]; then
  TMP_FILE="$(mktemp -t mimir-api-types.XXXXXX.ts)"
  trap 'rm -f "${TMP_FILE}"' EXIT

  echo "Fetching OpenAPI spec from ${SPEC_URL} (check mode)..."
  pnpm exec openapi-typescript "${SPEC_URL}" --output "${TMP_FILE}" >/dev/null

  if diff -u "${OUT_FILE}" "${TMP_FILE}"; then
    echo "OK: ${OUT_FILE} matches the live spec."
    exit 0
  else
    echo "" >&2
    echo "ERROR: ${OUT_FILE} is out of sync with the backend OpenAPI spec." >&2
    echo "       Run 'pnpm generate:api-types' locally and commit the result." >&2
    exit 1
  fi
fi

echo "Fetching OpenAPI spec from ${SPEC_URL}..."
pnpm exec openapi-typescript "${SPEC_URL}" --output "${OUT_FILE}"
echo "Types generated at ${OUT_FILE}"
