/**
 * AI Module Tests — 20 scenarios
 *
 * Covers safety guardrails, confidence scoring, disclaimers,
 * clinical pattern detection, route wiring, and default config.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Lib imports
// ---------------------------------------------------------------------------

import {
  sanitizeAIOutput,
  ensureSuggestiveLanguage,
  SAFETY_RULES,
} from '../lib/ai/safety/guardrails';

import {
  getConfidenceLevel,
  buildConfidence,
  aggregateConfidence,
} from '../lib/ai/safety/confidence';

import {
  getDisclaimer,
  getBilingualDisclaimer,
} from '../lib/ai/safety/disclaimer';

import type { DisclaimerContext } from '../lib/ai/safety/disclaimer';

import {
  detectPatterns,
} from '../lib/ai/clinical/patternDetector';

import type { LabDataPoint } from '../lib/ai/clinical/patternDetector';

import { DEFAULT_AI_SETTINGS } from '../lib/ai/providers/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROUTES_DIR = path.resolve(__dirname, '..', 'app', 'api', 'ai');

function readRoute(routeName: string): string {
  const filePath = path.join(ROUTES_DIR, routeName, 'route.ts');
  return fs.readFileSync(filePath, 'utf-8');
}

// ===========================================================================
// 1. Safety Guardrails (tests 1-5)
// ===========================================================================

describe('Safety Guardrails', () => {
  // ---- Test 1 ----
  it('1 — sanitizeAIOutput removes English forbidden phrases', () => {
    const input =
      'Based on the labs, you have iron deficiency and the diagnosis is confirmed.';
    const result = sanitizeAIOutput(input);

    expect(result.sanitized).toBe(true);
    expect(result.text).not.toContain('you have');
    expect(result.text).not.toContain('the diagnosis is');
    // The replacement marker should be present
    expect(result.text).toContain('[suggestion removed]');
  });

  // ---- Test 2 ----
  it('2 — sanitizeAIOutput detects the phrase "you have" (case-insensitive)', () => {
    const variations = [
      'You Have a condition',
      'YOU HAVE anemia',
      'you have elevated values',
    ];

    for (const text of variations) {
      const result = sanitizeAIOutput(text);
      expect(result.sanitized).toBe(true);
      expect(result.text).not.toMatch(/you have/i);
    }
  });

  // ---- Test 3 ----
  it('3 — sanitizeAIOutput detects Arabic forbidden phrase "أنت مصاب بـ"', () => {
    const input = 'النتائج تظهر أن أنت مصاب بـ فقر الدم';
    const result = sanitizeAIOutput(input);

    expect(result.sanitized).toBe(true);
    expect(result.text).not.toContain('أنت مصاب بـ');
    expect(result.text).toContain('[تمت إزالة الاقتراح]');
  });

  // ---- Test 4 ----
  it('4 — sanitizeAIOutput allows safe medical text through unchanged', () => {
    const safeText =
      'Lab values may suggest an elevated hemoglobin level. Consider further evaluation.';
    const result = sanitizeAIOutput(safeText);

    expect(result.sanitized).toBe(false);
    expect(result.text).toBe(safeText);
  });

  // ---- Test 5 ----
  it('5 — sanitizeAIOutput preserves non-diagnostic content while removing forbidden parts', () => {
    const mixed =
      'Iron studies are low. You should take ferrous sulfate. Recommend follow-up in 4 weeks.';
    const result = sanitizeAIOutput(mixed);

    expect(result.sanitized).toBe(true);
    // The non-forbidden parts should survive
    expect(result.text).toContain('Iron studies are low.');
    expect(result.text).toContain('Recommend follow-up in 4 weeks.');
    // The forbidden part should be replaced
    expect(result.text).not.toContain('You should take');
  });
});

// ===========================================================================
// 2. Confidence Scoring (tests 6-8)
// ===========================================================================

describe('Confidence Scoring', () => {
  // ---- Test 6 ----
  it('6 — getConfidenceLevel returns "high" for 0.9', () => {
    expect(getConfidenceLevel(0.9)).toBe('high');
  });

  // ---- Test 7 ----
  it('7 — getConfidenceLevel returns "medium" for 0.6', () => {
    expect(getConfidenceLevel(0.6)).toBe('medium');
  });

  // ---- Test 8 ----
  it('8 — getConfidenceLevel returns "low" for 0.3', () => {
    expect(getConfidenceLevel(0.3)).toBe('low');
  });
});

// ===========================================================================
// 3. Disclaimers (tests 9-10)
// ===========================================================================

describe('Disclaimers', () => {
  // ---- Test 9 ----
  it('9 — getDisclaimer("lab") returns bilingual disclaimer text', () => {
    const en = getDisclaimer('lab', 'en');
    const ar = getDisclaimer('lab', 'ar');

    expect(en.length).toBeGreaterThan(0);
    expect(ar.length).toBeGreaterThan(0);
    // English version should mention physician or lab specialist
    expect(en.toLowerCase()).toContain('physician');
    // Arabic version should be a different string
    expect(ar).not.toBe(en);
  });

  // ---- Test 10 ----
  it('10 — all 6 disclaimer contexts return valid non-empty disclaimers', () => {
    const contexts: DisclaimerContext[] = [
      'lab',
      'radiology',
      'clinical',
      'drug',
      'summary',
      'general',
    ];

    for (const ctx of contexts) {
      const en = getDisclaimer(ctx, 'en');
      const ar = getDisclaimer(ctx, 'ar');
      const bilingual = getBilingualDisclaimer(ctx);

      expect(en.length).toBeGreaterThan(10);
      expect(ar.length).toBeGreaterThan(10);
      expect(bilingual).toHaveProperty('ar');
      expect(bilingual).toHaveProperty('en');
    }
  });
});

// ===========================================================================
// 4. Pattern Detection (tests 11-15)
// ===========================================================================

describe('Pattern Detection', () => {
  // ---- Test 11 ----
  it('11 — detects Iron Deficiency Anemia with low HGB, MCV, and FERRITIN', () => {
    const labs: LabDataPoint[] = [
      { testCode: 'HGB', value: 9.0, unit: 'g/dL' },
      { testCode: 'MCV', value: 70, unit: 'fL' },
      { testCode: 'FERRITIN', value: 10, unit: 'ng/mL' },
    ];

    const patterns = detectPatterns(labs);
    const iron = patterns.find((p) => p.name === 'Iron Deficiency Anemia');

    expect(iron).toBeDefined();
    expect(iron!.matchedTests).toContain('HGB');
    expect(iron!.matchedTests).toContain('MCV');
    expect(iron!.matchedTests).toContain('FERRITIN');
    expect(iron!.severity).toBe('moderate');
  });

  // ---- Test 12 ----
  it('12 — detects DKA with high glucose and low CO2', () => {
    const labs: LabDataPoint[] = [
      { testCode: 'GLU', value: 450, unit: 'mg/dL' },
      { testCode: 'CO2', value: 12, unit: 'mmol/L' },
    ];

    const patterns = detectPatterns(labs);
    const dka = patterns.find((p) => p.name.includes('DKA'));

    expect(dka).toBeDefined();
    expect(dka!.matchedTests).toContain('GLU');
    expect(dka!.matchedTests).toContain('CO2');
    expect(dka!.severity).toBe('high');
  });

  // ---- Test 13 ----
  it('13 — detects sepsis markers with high WBC and CRP', () => {
    const labs: LabDataPoint[] = [
      { testCode: 'WBC', value: 18, unit: '10^3/uL' },
      { testCode: 'CRP', value: 55, unit: 'mg/L' },
    ];

    const patterns = detectPatterns(labs);
    const sepsis = patterns.find((p) => p.name === 'Sepsis Markers');

    expect(sepsis).toBeDefined();
    expect(sepsis!.matchedTests).toContain('WBC');
    expect(sepsis!.matchedTests).toContain('CRP');
    expect(sepsis!.severity).toBe('high');
  });

  // ---- Test 14 ----
  it('14 — returns no patterns when all labs are within normal range', () => {
    const labs: LabDataPoint[] = [
      { testCode: 'HGB', value: 14.5, unit: 'g/dL' },
      { testCode: 'MCV', value: 88, unit: 'fL' },
      { testCode: 'FERRITIN', value: 120, unit: 'ng/mL' },
      { testCode: 'GLU', value: 90, unit: 'mg/dL' },
      { testCode: 'WBC', value: 7.0, unit: '10^3/uL' },
      { testCode: 'CRP', value: 3.0, unit: 'mg/L' },
      { testCode: 'CREAT', value: 0.9, unit: 'mg/dL' },
      { testCode: 'BUN', value: 15, unit: 'mg/dL' },
      { testCode: 'ALT', value: 25, unit: 'U/L' },
      { testCode: 'AST', value: 22, unit: 'U/L' },
      { testCode: 'TSH', value: 2.5, unit: 'mIU/L' },
    ];

    const patterns = detectPatterns(labs);
    expect(patterns).toHaveLength(0);
  });

  // ---- Test 15 ----
  it('15 — pattern confidence equals matched conditions / total conditions', () => {
    // Iron Deficiency has 4 conditions (HGB, MCV, FERRITIN, TIBC) with minMatch=3
    // Provide 3 matching out of 4 total
    const labs: LabDataPoint[] = [
      { testCode: 'HGB', value: 9, unit: 'g/dL' },       // low < 12 -> match
      { testCode: 'MCV', value: 70, unit: 'fL' },         // low < 80 -> match
      { testCode: 'FERRITIN', value: 10, unit: 'ng/mL' }, // low < 30 -> match
      // TIBC not provided, so only 3/4 match
    ];

    const patterns = detectPatterns(labs);
    const iron = patterns.find((p) => p.name === 'Iron Deficiency Anemia');

    expect(iron).toBeDefined();
    // confidence = 3 matched / 4 total conditions = 0.75
    expect(iron!.confidence.value).toBe(0.75);
    expect(iron!.confidence.level).toBe('medium');
    expect(iron!.confidence.reasoning).toContain('3/4');
  });
});

// ===========================================================================
// 5. Route Wiring (tests 16-18)
// ===========================================================================

describe('Route Wiring', () => {
  const routeNames = [
    'interpret-labs',
    'radiology-assist',
    'drug-check',
    'clinical-alert',
    'summarize-patient',
    'config',
  ];

  // ---- Test 16 ----
  it('16 — all AI routes use withAuthTenant and withErrorHandler', () => {
    for (const name of routeNames) {
      const src = readRoute(name);
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('withErrorHandler');
    }
  });

  // ---- Test 17 ----
  it('17 — input size limits [AI-01] are enforced in data-accepting routes', () => {
    const dataRoutes = [
      'interpret-labs',
      'radiology-assist',
      'drug-check',
      'clinical-alert',
      'summarize-patient',
    ];

    for (const name of dataRoutes) {
      const src = readRoute(name);
      // Each data route should reference the AI-01 input size limit tag
      expect(src).toContain('[AI-01]');
      // Each should return INPUT_TOO_LARGE error code or check .length
      expect(src).toMatch(/INPUT_TOO_LARGE|\.length\s*>/);
    }
  });

  // ---- Test 18 ----
  it('18 — rate limiting [AI-02] is enforced via checkRateLimit in all engine routes', () => {
    const engineRoutes = [
      'interpret-labs',
      'radiology-assist',
      'drug-check',
      'clinical-alert',
      'summarize-patient',
    ];

    for (const name of engineRoutes) {
      const src = readRoute(name);
      // All engine routes should call checkRateLimit and return 429
      expect(src).toContain('checkRateLimit');
      expect(src).toContain('429');
    }
  });
});

// ===========================================================================
// 6. Config & Defaults (tests 19-20)
// ===========================================================================

describe('Config & Defaults', () => {
  // ---- Test 19 ----
  it('19 — DEFAULT_AI_SETTINGS has correct structure and values', () => {
    expect(DEFAULT_AI_SETTINGS).toBeDefined();
    expect(DEFAULT_AI_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_AI_SETTINGS.provider).toBe('openai');
    expect(DEFAULT_AI_SETTINGS.anthropicModel).toBe('claude-sonnet-4-20250514');
    expect(DEFAULT_AI_SETTINGS.openaiModel).toBe('gpt-4o-mini');
    expect(DEFAULT_AI_SETTINGS.auditEnabled).toBe(true);
    expect(DEFAULT_AI_SETTINGS.maxRequestsPerMinute).toBe(30);
    expect(DEFAULT_AI_SETTINGS.departments).toEqual([]);

    // All 5 feature flags should exist and default to true
    const features = DEFAULT_AI_SETTINGS.features;
    expect(features.labInterpretation).toBe(true);
    expect(features.radiologyAssist).toBe(true);
    expect(features.clinicalDecisionSupport).toBe(true);
    expect(features.patientSummary).toBe(true);
    expect(features.drugInteraction).toBe(true);
  });

  // ---- Test 20 ----
  it('20 — AI config route requires admin.settings permission', () => {
    const src = readRoute('config');

    // Both GET and POST should require admin.settings
    const matches = src.match(/permissionKey:\s*['"]admin\.settings['"]/g);
    expect(matches).not.toBeNull();
    // There should be 2 occurrences (GET and POST)
    expect(matches!.length).toBe(2);
  });
});
