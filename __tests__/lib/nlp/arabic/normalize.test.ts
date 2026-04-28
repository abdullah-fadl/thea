/**
 * Phase 6.1 — Arabic normalizer tests
 *
 * Cases:
 *  1.  Tatweel (kashida) removal
 *  2.  Fatha diacritic removal
 *  3.  Kasra diacritic removal
 *  4.  Damma diacritic removal
 *  5.  Shadda diacritic removal
 *  6.  Tanween (nunation) removal
 *  7.  Alef with hamza above (أ → ا)
 *  8.  Alef with hamza below (إ → ا)
 *  9.  Alef with madda (آ → ا)
 * 10.  Alef wasla (ٱ → ا)
 * 11.  Yaa / alef-maqsura (ى → ي)
 * 12.  Taa-marbuta (ة → ه)
 * 13.  Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩ → 0-9)
 * 14.  Idempotency (apply twice = apply once)
 * 15.  Empty string → empty string
 * 16.  Whitespace normalization
 * 17.  Flag OFF → trim + lowercase only
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { normalizeArabic } from '@/lib/nlp/arabic/normalize';

function enableFlag()  { process.env[FLAGS.FF_ARABIC_NLP_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_ARABIC_NLP_ENABLED]; }

describe('normalizeArabic — flag ON', () => {
  beforeEach(enableFlag);
  afterEach(disableFlag);

  it('Case 1: removes tatweel (kashida)', () => {
    expect(normalizeArabic('مرحـبـا')).toBe('مرحبا');
  });

  it('Case 2: removes fatha diacritic', () => {
    expect(normalizeArabic('كَتَبَ')).toBe('كتب');
  });

  it('Case 3: removes kasra diacritic', () => {
    expect(normalizeArabic('بِسمِ')).toBe('بسم');
  });

  it('Case 4: removes damma diacritic', () => {
    expect(normalizeArabic('كُتُب')).toBe('كتب');
  });

  it('Case 5: removes shadda', () => {
    expect(normalizeArabic('شدَّة')).toBe('شده');
  });

  it('Case 6: removes tanween (مريضٌ → مريض, no structural alef)', () => {
    expect(normalizeArabic('مريضٌ')).toBe('مريض');
  });

  it('Case 7: alef with hamza above (أ) → ا', () => {
    expect(normalizeArabic('أحمد')).toBe('احمد');
  });

  it('Case 8: alef with hamza below (إ) → ا', () => {
    expect(normalizeArabic('إسهال')).toBe('اسهال');
  });

  it('Case 9: alef with madda (آ) → ا', () => {
    expect(normalizeArabic('آلام')).toBe('الام');
  });

  it('Case 10: alef wasla (ٱ) → ا', () => {
    expect(normalizeArabic('ٱلله')).toBe('الله');
  });

  it('Case 11: yaa / alef-maqsura (ى) → ي', () => {
    expect(normalizeArabic('مستشفى')).toBe('مستشفي');
  });

  it('Case 12: taa-marbuta (ة) → ه', () => {
    expect(normalizeArabic('حرارة')).toBe('حراره');
  });

  it('Case 13: Arabic-Indic digits → ASCII digits', () => {
    expect(normalizeArabic('العمر ٣٥ سنة')).toBe('العمر 35 سنه');
  });

  it('Case 14: idempotent — applying twice equals applying once', () => {
    const once = normalizeArabic('يدوّخني');
    const twice = normalizeArabic(once);
    expect(twice).toBe(once);
  });

  it('Case 15: empty string returns empty string', () => {
    expect(normalizeArabic('')).toBe('');
  });

  it('Case 16: collapses multiple whitespace and trims', () => {
    expect(normalizeArabic('  وجع   في   صدري  ')).toBe('وجع في صدري');
  });

  it('Case 17 (Saudi dialect): يدوّخني → يدوخني after tatweel + diacritics removal', () => {
    expect(normalizeArabic('يدوّخني')).toBe('يدوخني');
  });
});

describe('normalizeArabic — flag OFF (passthrough)', () => {
  beforeEach(disableFlag);

  it('Case 17: flag OFF → trim + lowercase only, no Arabic normalization', () => {
    const input = 'يدوّخني  ';
    const result = normalizeArabic(input);
    // Must trim but NOT do Arabic normalization
    expect(result).toBe('يدوّخني');
    expect(result).toContain('\u0651'); // shadda still present
  });

  it('flag OFF → lowercase Latin in mixed text', () => {
    const result = normalizeArabic('  Hello WORLD  ');
    expect(result).toBe('hello world');
  });
});
