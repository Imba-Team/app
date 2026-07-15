const DEFAULT_API_BASE_URL = 'http://localhost:9090';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

export function buildApiUrl(path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function buildAssetUrl(path?: string | null) {
  if (!path) return undefined;
  return buildApiUrl(path);
}
