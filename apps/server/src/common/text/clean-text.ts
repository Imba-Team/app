/**
 * Input hygiene for user-provided free text (MIM-49).
 *
 * Text is stored as plain text and every client renders it as text
 * (React escapes it), so HTML is deliberately NOT stripped: flashcards
 * legitimately contain things like `List<String>` or `a < b`. Anything
 * that renders user text as HTML must escape it at that sink instead
 * (e.g. Elasticsearch highlights use `encoder: 'html'`).
 *
 * What we do remove is text that is invisible or misleading wherever it
 * ends up — emails, logs, push notifications, other people's screens:
 * - C0/C1 control characters (NUL, ESC, …), keeping tab and newline
 * - bidirectional embedding/override/isolate controls ("Trojan Source"
 *   style spoofing; U+202A–U+202E, U+2066–U+2069)
 * - the byte-order mark (U+FEFF)
 * Line endings are normalised to `\n` and the result is NFC-normalised so
 * visually identical strings compare equal (answers, tags, search).
 */

// eslint-disable-next-line no-control-regex
const controlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const bidiControls = /[\u202A-\u202E\u2066-\u2069]/g;
const byteOrderMark = /\uFEFF/g;

export function cleanText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(controlChars, '')
    .replace(bidiControls, '')
    .replace(byteOrderMark, '')
    .normalize('NFC');
}

/** Keys whose values must reach the handler byte-for-byte. */
const verbatimKey = /password|token|secret/i;

/**
 * Apply {@link cleanText} to every string in a JSON-like value. Values
 * under password/token/secret keys are left untouched. Non-plain objects
 * (Buffers, Dates, uploaded files) are returned as-is.
 */
export function cleanTextDeep<T>(value: T): T {
  if (typeof value === 'string') return cleanText(value) as T;
  if (Array.isArray(value)) {
    return (value as unknown[]).map((v) => cleanTextDeep(v)) as T;
  }
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = verbatimKey.test(key) ? v : cleanTextDeep(v);
  }
  return out as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}
