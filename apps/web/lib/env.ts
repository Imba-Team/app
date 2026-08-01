const DEFAULT_API_BASE_URL = 'http://localhost:9090';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;

export function buildApiUrl(path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Resolve an asset URL that may be either:
 *   - an absolute URL (e.g. MinIO / CDN host) — returned as-is
 *   - a relative path (legacy `/uploads/...` avatars served by Nest) —
 *     prefixed with the API origin so the browser can fetch it
 *
 * The server-side media pipeline now emits absolute URLs, so the
 * pass-through branch is the common path. The relative branch is
 * retained for the small number of legacy avatar rows that predate the
 * media module.
 */
export function buildAssetUrl(path?: string | null) {
  if (!path) return undefined;
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return buildApiUrl(path);
}
