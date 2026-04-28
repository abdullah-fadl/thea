import { normalizeArabic } from './normalize';

// Split on whitespace and common punctuation (Arabic + Latin)
// Includes: space, tabs, Arabic comma/semicolon/question mark, Latin punctuation
const SPLIT_RE = /[\s\u060C\u061B\u061F\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E،؛؟]+/;

// Strip any remaining non-word, non-Arabic characters from token edges
const STRIP_EDGES = /^[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\w]+|[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\w]+$/g;

/**
 * Splits text into tokens on whitespace and punctuation.
 * Preserves Arabic word boundaries. Lowercases Latin letters.
 * Filters tokens shorter than 2 characters and punctuation-only tokens.
 *
 * When FF_ARABIC_NLP_ENABLED is OFF, normalizeArabic() runs in passthrough mode
 * (lowercase+trim) — basic splitting still works.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];

  const normalized = normalizeArabic(text);

  return normalized
    .split(SPLIT_RE)
    .map((t) => t.replace(STRIP_EDGES, ''))
    .filter((t) => t.length >= 2);
}
