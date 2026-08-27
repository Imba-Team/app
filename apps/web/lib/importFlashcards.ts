/**
 * Parse pasted text into flashcard pairs using user-selected separators.
 *
 * The between-separator splits a single line/entry into `term` and
 * `definition`; the card-separator splits the full blob into entries.
 * Both accept common presets (tab, comma, newline, etc.) or a custom
 * string. Backslash escapes (`\t`, `\n`, `\r`, `\\`) are honoured in
 * custom separators so users can type `\t` in a text field and get an
 * actual tab.
 */

export type PresetBetween = 'tab' | 'comma' | 'dash' | 'semicolon' | 'custom';
export type PresetCard = 'newline' | 'doubleNewline' | 'semicolon' | 'custom';

export interface ParsedCard {
  /** 1-based index into the original entries array. */
  index: number;
  term: string;
  definition: string;
}

export interface SkippedEntry {
  index: number;
  raw: string;
  reason: 'missing-separator' | 'empty-term' | 'empty-definition';
}

export interface ParseResult {
  cards: ParsedCard[];
  skipped: SkippedEntry[];
  /** Total non-empty entries seen (cards + skipped). */
  total: number;
}

const presetBetween: Record<Exclude<PresetBetween, 'custom'>, string> = {
  tab: '\t',
  comma: ',',
  dash: ' - ',
  semicolon: ';',
};

const presetCard: Record<Exclude<PresetCard, 'custom'>, string> = {
  newline: '\n',
  doubleNewline: '\n\n',
  semicolon: ';',
};

/**
 * Convert user-facing escape sequences (`\t`, `\n`, `\r`, `\\`) into
 * their literal characters. Anything else after a backslash passes
 * through unchanged so unrelated backslashes in separators don't get
 * silently rewritten.
 */
export function unescapeSeparator(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '\\' && i + 1 < input.length) {
      const next = input[i + 1];
      switch (next) {
        case 't':
          out += '\t';
          i++;
          continue;
        case 'n':
          out += '\n';
          i++;
          continue;
        case 'r':
          out += '\r';
          i++;
          continue;
        case '\\':
          out += '\\';
          i++;
          continue;
        default:
          out += ch;
          continue;
      }
    }
    out += ch;
  }
  return out;
}

export function resolveBetween(preset: PresetBetween, custom: string): string {
  if (preset === 'custom') return unescapeSeparator(custom);
  return presetBetween[preset];
}

export function resolveCard(preset: PresetCard, custom: string): string {
  if (preset === 'custom') return unescapeSeparator(custom);
  return presetCard[preset];
}

/** Split by a separator that could be multi-character. Empty separator
 *  is treated as "each character" — we guard against it upstream. */
function splitBy(source: string, sep: string): string[] {
  if (sep.length === 0) return [source];
  // Normalise CRLF → LF so a `\n` card separator behaves consistently
  // regardless of the paste source (Windows clipboards, GitHub, etc).
  const normalised = source.replace(/\r\n/g, '\n');
  return normalised.split(sep);
}

export interface ParseOptions {
  text: string;
  betweenPreset: PresetBetween;
  betweenCustom: string;
  cardPreset: PresetCard;
  cardCustom: string;
}

export function parseImport({
  text,
  betweenPreset,
  betweenCustom,
  cardPreset,
  cardCustom,
}: ParseOptions): ParseResult {
  const between = resolveBetween(betweenPreset, betweenCustom);
  const cardSep = resolveCard(cardPreset, cardCustom);

  if (!text.trim() || !between || !cardSep) {
    return { cards: [], skipped: [], total: 0 };
  }

  const rawEntries = splitBy(text, cardSep);
  const cards: ParsedCard[] = [];
  const skipped: SkippedEntry[] = [];
  let index = 0;

  for (const raw of rawEntries) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    index++;

    const sepAt = trimmed.indexOf(between);
    if (sepAt === -1) {
      skipped.push({ index, raw: trimmed, reason: 'missing-separator' });
      continue;
    }

    const term = trimmed.slice(0, sepAt).trim();
    const definition = trimmed.slice(sepAt + between.length).trim();

    if (!term) {
      skipped.push({ index, raw: trimmed, reason: 'empty-term' });
      continue;
    }
    if (!definition) {
      skipped.push({ index, raw: trimmed, reason: 'empty-definition' });
      continue;
    }

    cards.push({ index, term, definition });
  }

  return { cards, skipped, total: index };
}
