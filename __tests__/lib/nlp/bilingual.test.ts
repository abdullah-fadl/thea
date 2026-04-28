/**
 * Phase 6.1 — Bilingual search term expansion tests
 *
 * Cases:
 *  1.  Flag OFF → returns [query] only (passthrough)
 *  2.  Arabic query → includes normalized form
 *  3.  Arabic query → includes variant with ال prefix
 *  4.  Arabic query with ال → includes stripped form
 *  5.  Arabic query matched in lexicon → canonical term included
 *  6.  English query → includes lowercase + plural variant
 *  7.  English plural query → includes singular variant
 *  8.  Empty string → returns []
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { expandSearchTerms } from '@/lib/nlp/bilingual/searchTerms';

function enableFlag()  { process.env[FLAGS.FF_ARABIC_NLP_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_ARABIC_NLP_ENABLED]; }

describe('expandSearchTerms — flag OFF', () => {
  beforeEach(disableFlag);

  it('Case 1: flag OFF → returns [query] only', () => {
    const result = expandSearchTerms('وجع في صدري');
    expect(result).toEqual(['وجع في صدري']);
  });
});

describe('expandSearchTerms — flag ON', () => {
  beforeEach(enableFlag);
  afterEach(disableFlag);

  it('Case 2: Arabic query includes normalized form', () => {
    const result = expandSearchTerms('يدوّخني');
    // normalized form removes diacritics/tatweel
    expect(result.some((t) => t === 'يدوخني')).toBe(true);
  });

  it('Case 3: Arabic query includes variant with ال prefix', () => {
    const result = expandSearchTerms('صداع');
    expect(result.some((t) => t.startsWith('ال'))).toBe(true);
  });

  it('Case 4: Arabic query starting with ال includes stripped form', () => {
    const result = expandSearchTerms('الصداع');
    // normalized = الصداع, stripped = صداع
    expect(result.some((t) => t === 'صداع')).toBe(true);
  });

  it('Case 5: Arabic query matched in lexicon includes canonical', () => {
    const result = expandSearchTerms('غثيان');
    expect(result).toContain('nausea');
  });

  it('Case 6: English query lowercased + plural variant added', () => {
    const result = expandSearchTerms('Headache');
    expect(result).toContain('headache');
    expect(result).toContain('headaches');
  });

  it('Case 7: English plural → singular variant included', () => {
    const result = expandSearchTerms('symptoms');
    expect(result).toContain('symptom');
  });

  it('Case 8: empty string returns empty array', () => {
    expect(expandSearchTerms('')).toEqual([]);
  });
});
