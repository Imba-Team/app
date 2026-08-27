export function slugify(input: string, maxLength = 50): string {
  if (!input) return 'item';

  // normalize, remove diacritics, convert to lowercase
  let slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alnum with hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .replace(/-{2,}/g, '-'); // collapse multiple hyphens

  if (!slug) slug = 'item';
  if (slug.length > maxLength)
    slug = slug.slice(0, maxLength).replace(/-+$/g, '');

  return slug;
}

/**
 * Create a unique slug from a string given an existing collection of slugs.
 * - existing can be a Set<string> or string[].
 * - If a collision occurs, appends "-2", "-3", ... until unique.
 */
export default function createUniqueSlug(
  input: string,
  existing?: Set<string> | string[],
  maxLength = 50,
): string {
  const base = slugify(input, maxLength);
  if (!existing) return base;

  const set = Array.isArray(existing) ? new Set(existing) : existing;

  if (!set.has(base)) return base;

  // try suffixes until unique
  for (let i = 2; i < Number.MAX_SAFE_INTEGER; i++) {
    const suffix = `-${i}`;
    // ensure total length limit
    const allowedBaseLen = Math.max(1, maxLength - suffix.length);
    const truncatedBase =
      base.length > allowedBaseLen
        ? base.slice(0, allowedBaseLen).replace(/-+$/g, '')
        : base;
    const candidate = `${truncatedBase}${suffix}`;
    if (!set.has(candidate)) return candidate;
  }

  // Fallback (shouldn't realistically happen)
  return `${base}-${Date.now()}`;
}
