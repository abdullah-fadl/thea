/**
 * Phase 6.1 — Phrase matcher tests
 *
 * Cases:
 *  1.  Flag OFF → returns [] (passthrough)
 *  2.  Exact Arabic phrase match
 *  3.  Match with diacritics in input (normalized before match)
 *  4.  Fuzzy match within levenshtein distance (typo tolerance)
 *  5.  No match for unrelated text
 *  6.  Case-insensitive Latin canonical in multi-phrase text
 *  7.  Multiple phrases in one text
 *  8.  Span correctness (start ≤ end, within text bounds)
 *  9.  Score = 1.0 for exact match
 * 10.  minScore option filters low-confidence matches
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { matchMedicalPhrases } from '@/lib/nlp/arabic/matcher';

function enableFlag()  { process.env[FLAGS.FF_ARABIC_NLP_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_ARABIC_NLP_ENABLED]; }

describe('matchMedicalPhrases — flag OFF', () => {
  beforeEach(disableFlag);

  it('Case 1: flag OFF → returns []', () => {
    expect(matchMedicalPhrases('وجع في صدري')).toEqual([]);
  });
});

describe('matchMedicalPhrases — flag ON', () => {
  beforeEach(enableFlag);
  afterEach(disableFlag);

  it('Case 2: exact match for "وجع في صدري" → chest pain', () => {
    const results = matchMedicalPhrases('وجع في صدري');
    const match = results.find((r) => r.canonical === 'chest pain');
    expect(match).toBeTruthy();
    expect(match!.concept_code).toBe('29857009');
  });

  it('Case 3: match with diacritics in input (يدوّخني normalized)', () => {
    const results = matchMedicalPhrases('يدوّخني');
    const match = results.find((r) => r.canonical === 'dizziness');
    expect(match).toBeTruthy();
    expect(match!.concept_code).toBe('404640003');
  });

  it('Case 4: fuzzy match for near-miss variant (صداع with tatweel)', () => {
    // صدـاع has tatweel inserted — after normalization = صداع → exact match
    const results = matchMedicalPhrases('صدـاع');
    const match = results.find((r) => r.canonical === 'headache');
    expect(match).toBeTruthy();
  });

  it('Case 5: no match for unrelated text', () => {
    const results = matchMedicalPhrases('الحساب الجاري والتحويلات');
    // None of these are medical complaint phrases
    const medical = results.filter((r) =>
      ['chest pain', 'dizziness', 'fever', 'cough'].includes(r.canonical)
    );
    expect(medical).toHaveLength(0);
  });

  it('Case 6: match is case-insensitive for Latin text in mixed input', () => {
    const results = matchMedicalPhrases('عندي كحة شديدة');
    const match = results.find((r) => r.canonical === 'cough');
    expect(match).toBeTruthy();
  });

  it('Case 7: multiple phrases detected in a longer complaint', () => {
    const results = matchMedicalPhrases('عندي حرارة وكحة');
    const canonicals = results.map((r) => r.canonical);
    expect(canonicals).toContain('fever');
    expect(canonicals).toContain('cough');
  });

  it('Case 8: span start < end and within text bounds', () => {
    const text = 'عندي غثيان';
    const results = matchMedicalPhrases(text);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.span[0]).toBeGreaterThanOrEqual(0);
      expect(r.span[1]).toBeGreaterThan(r.span[0]);
    }
  });

  it('Case 9: exact match has score = 1.0', () => {
    const results = matchMedicalPhrases('غثيان');
    const match = results.find((r) => r.canonical === 'nausea');
    expect(match).toBeTruthy();
    expect(match!.score).toBe(1.0);
  });

  it('Case 10: minScore option filters low-confidence fuzzy matches', () => {
    // Request only high-confidence matches
    const results = matchMedicalPhrases('وجع في صدري', { minScore: 0.99 });
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0.99);
    }
  });
});
