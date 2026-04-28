import { isEnabled } from '@/lib/core/flags';
import { normalizeArabic } from '@/lib/nlp/arabic/normalize';
import { matchMedicalPhrases } from '@/lib/nlp/arabic/matcher';

// Matches any Arabic Unicode character
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Expands a search query into normalized variant forms for cross-language matching.
 *
 * Flag OFF → returns [query] only (passthrough).
 * Flag ON, Arabic query:
 *   - normalizeArabic(query)
 *   - variant with ال prefix
 *   - variant without ال prefix (if present)
 *   - canonical terms from lexicon matches
 * Flag ON, English/other query:
 *   - lowercase
 *   - plural (+ 's') or singular (− 's') variant
 */
export function expandSearchTerms(query: string): string[] {
  if (!query) return [];

  if (!isEnabled('FF_ARABIC_NLP_ENABLED')) return [query];

  const terms = new Set<string>([query]);

  if (ARABIC_RE.test(query)) {
    const normalized = normalizeArabic(query);
    terms.add(normalized);

    // Variant: with definite article ال
    terms.add('\u0627\u0644' + normalized);

    // Variant: strip ال prefix if present
    if (normalized.startsWith('\u0627\u0644') && normalized.length > 2) {
      terms.add(normalized.slice(2));
    }

    // Lexicon-based canonical expansion
    const matches = matchMedicalPhrases(query);
    for (const m of matches) {
      terms.add(m.canonical);
    }
  } else {
    const lower = query.toLowerCase().trim();
    terms.add(lower);

    if (lower.endsWith('s') && lower.length > 3) {
      terms.add(lower.slice(0, -1)); // singular
    } else {
      terms.add(lower + 's'); // plural
    }
  }

  return Array.from(terms).filter((t) => t.length > 0);
}
