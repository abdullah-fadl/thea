/**
 * Phase 6.1 — Lexicon loader tests
 *
 * Cases:
 *  1.  getMedicalPhrases() returns a non-empty array
 *  2.  Every entry has required fields: phrase, canonical, concept_code_system, concept_code
 *  3.  No duplicate phrases
 *  4.  All concept codes are non-empty strings
 */

import { describe, it, expect } from 'vitest';
import { getMedicalPhrases } from '@/lib/nlp/arabic/lexicon/loader';

describe('getMedicalPhrases — lexicon loader', () => {
  it('Case 1: returns a non-empty array', () => {
    const phrases = getMedicalPhrases();
    expect(Array.isArray(phrases)).toBe(true);
    expect(phrases.length).toBeGreaterThan(0);
  });

  it('Case 2: every entry has required fields with non-empty string values', () => {
    const phrases = getMedicalPhrases();
    for (const entry of phrases) {
      expect(typeof entry.phrase).toBe('string');
      expect(entry.phrase.length).toBeGreaterThan(0);
      expect(typeof entry.canonical).toBe('string');
      expect(entry.canonical.length).toBeGreaterThan(0);
      expect(typeof entry.concept_code_system).toBe('string');
      expect(entry.concept_code_system.length).toBeGreaterThan(0);
      expect(typeof entry.concept_code).toBe('string');
      expect(entry.concept_code.length).toBeGreaterThan(0);
    }
  });

  it('Case 3: no duplicate phrases', () => {
    const phrases = getMedicalPhrases();
    const seen = new Set<string>();
    for (const entry of phrases) {
      expect(seen.has(entry.phrase)).toBe(false);
      seen.add(entry.phrase);
    }
  });

  it('Case 4: all concept_code values are purely numeric strings (SNOMED CT format)', () => {
    const phrases = getMedicalPhrases();
    for (const entry of phrases) {
      expect(entry.concept_code).toMatch(/^\d+$/);
    }
  });
});
