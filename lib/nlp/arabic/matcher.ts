import { isEnabled } from '@/lib/core/flags';
import { normalizeArabic } from './normalize';
import { getMedicalPhrases, LexiconNotLoaded } from './lexicon/loader';

export { LexiconNotLoaded };

export interface PhraseMatch {
  phrase: string;
  canonical: string;
  concept_code_system: string;
  concept_code: string;
  span: [number, number];
  score: number;
}

/**
 * Standard iterative Levenshtein distance.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }

  return dp[n];
}

/**
 * Scans text for lexicon phrases using exact + optional fuzzy matching.
 *
 * Flag OFF → returns [].
 * Flag ON, lexicon unavailable → throws LexiconNotLoaded.
 *
 * Fuzzy tolerance: Levenshtein ≤ 1 for phrases ≤ 5 chars, ≤ 2 for longer phrases.
 * Score: 1.0 for exact match; 1 − distance/phraseLen for fuzzy.
 */
export function matchMedicalPhrases(
  text: string,
  opts?: { fuzzy?: boolean; minScore?: number }
): PhraseMatch[] {
  if (!isEnabled('FF_ARABIC_NLP_ENABLED')) return [];

  const phrases = getMedicalPhrases(); // throws LexiconNotLoaded if unavailable
  const normalized = normalizeArabic(text);
  const fuzzy = opts?.fuzzy !== false; // default true
  const minScore = opts?.minScore ?? 0;
  const results: PhraseMatch[] = [];

  for (const entry of phrases) {
    const normPhrase = normalizeArabic(entry.phrase);
    const pLen = normPhrase.length;

    // ── Exact match ──────────────────────────────────────────────────────────
    const exactIdx = normalized.indexOf(normPhrase);
    if (exactIdx !== -1 && 1.0 >= minScore) {
      results.push({
        phrase: entry.phrase,
        canonical: entry.canonical,
        concept_code_system: entry.concept_code_system,
        concept_code: entry.concept_code,
        span: [exactIdx, exactIdx + pLen],
        score: 1.0,
      });
      continue;
    }

    if (!fuzzy) continue;

    // ── Fuzzy match via sliding window ───────────────────────────────────────
    const maxDist = pLen <= 5 ? 1 : 2;

    // Try windows of length pLen and pLen±1 to handle slight length differences
    for (const wLen of [pLen, pLen - 1, pLen + 1]) {
      if (wLen < 2 || wLen > normalized.length) continue;

      let found = false;
      for (let i = 0; i <= normalized.length - wLen; i++) {
        const window = normalized.slice(i, i + wLen);
        const dist = levenshtein(window, normPhrase);
        if (dist <= maxDist) {
          const score = 1 - dist / Math.max(pLen, wLen);
          if (score >= minScore) {
            results.push({
              phrase: entry.phrase,
              canonical: entry.canonical,
              concept_code_system: entry.concept_code_system,
              concept_code: entry.concept_code,
              span: [i, i + wLen],
              score,
            });
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }
  }

  return results;
}
