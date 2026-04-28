/**
 * Phase 6.1 — Tokenizer tests
 *
 * Cases:
 *  1.  Pure Arabic text splits on whitespace
 *  2.  Mixed Arabic + English text
 *  3.  Arabic punctuation as delimiter
 *  4.  Short-token filter (< 2 chars removed)
 *  5.  Punctuation-only tokens removed
 *  6.  Empty string returns []
 *  7.  Repeated spaces handled
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { tokenize } from '@/lib/nlp/arabic/tokenize';

function enableFlag()  { process.env[FLAGS.FF_ARABIC_NLP_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_ARABIC_NLP_ENABLED]; }

describe('tokenize — flag ON', () => {
  beforeEach(enableFlag);
  afterEach(disableFlag);

  it('Case 1: pure Arabic text splits into words', () => {
    const tokens = tokenize('وجع في صدري');
    expect(tokens).toContain('وجع');
    expect(tokens).toContain('في');
    expect(tokens).toContain('صدري');
    expect(tokens).toHaveLength(3);
  });

  it('Case 2: mixed Arabic + English preserves both', () => {
    const tokens = tokenize('عندي fever شديد');
    expect(tokens).toContain('fever');
    expect(tokens).toContain('شديد');
  });

  it('Case 3: Arabic punctuation (، ؛ ؟) acts as delimiter', () => {
    const tokens = tokenize('وجع؛ حرارة؟ كحة');
    expect(tokens).toContain('وجع');
    expect(tokens).toContain('حراره'); // taa-marbuta normalized
    expect(tokens).toContain('كحه');
  });

  it('Case 4: tokens shorter than 2 chars are filtered out', () => {
    const tokens = tokenize('في و وجع');
    // 'و' is 1 char → removed; 'في' is 2 chars → kept
    expect(tokens).not.toContain('و');
    expect(tokens).toContain('في');
  });

  it('Case 5: punctuation-only tokens are removed', () => {
    const tokens = tokenize('وجع . في صدري');
    expect(tokens).not.toContain('.');
  });

  it('Case 6: empty string returns empty array', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('Case 7: multiple consecutive spaces handled correctly', () => {
    const tokens = tokenize('راسي    يدور');
    expect(tokens).toContain('راسي');
    expect(tokens).toContain('يدور');
    expect(tokens).toHaveLength(2);
  });
});

describe('tokenize — flag OFF (passthrough)', () => {
  beforeEach(disableFlag);
  afterEach(() => {});

  it('still splits text even when flag OFF (basic passthrough)', () => {
    const tokens = tokenize('وجع في صدري');
    // normalize is passthrough but split still works
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens).toContain('وجع');
  });
});
