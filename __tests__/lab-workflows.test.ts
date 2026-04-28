/**
 * Lab Module — 20 Vitest Scenarios
 *
 * Covers: reference ranges, critical values, auto-validation, panels,
 * QC Westgard rules, barcode generation, TAT tracking, and route wiring.
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

import {
  getReferenceRange,
  getRangesByCategory,
  getCategories,
} from '../lib/lab/referenceRanges';

import {
  checkCriticalValue,
  isCriticalValue,
} from '../lib/lab/criticalValues';

import {
  evaluateAutoValidation,
  evaluateBatch,
  type ValidationInput,
} from '../lib/lab/autoValidation';

import {
  getPanelByCode,
  getPanelsByDepartment,
  getDepartments,
  getRequiredTubes,
} from '../lib/lab/panels';

import {
  calculateZScore,
  evaluateWestgard,
} from '../lib/lab/qualityControl';

import {
  generateAccessionNumber,
  parseAccessionNumber,
  generateSpecimenBarcode,
  parseSpecimenBarcode,
} from '../lib/lab/barcode';

import {
  calculateTATBreakdown,
  getCurrentStage,
  isTATExceeded,
  formatTAT,
} from '../lib/lab/tatTracking';

// ---------------------------------------------------------------------------
// Helper for reading route source files
// ---------------------------------------------------------------------------

function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

// ===========================================================================
// 1. Reference Ranges (scenarios 1-3)
// ===========================================================================

describe('Reference Ranges', () => {
  it('1 — getReferenceRange returns ranges for known tests (WBC, HGB, GLU)', () => {
    const wbc = getReferenceRange('WBC');
    expect(wbc).toBeDefined();
    expect(wbc!.normalRange.min).toBe(4.5);
    expect(wbc!.normalRange.max).toBe(11.0);
    expect(wbc!.unit).toBe('10^3/uL');

    const hgb = getReferenceRange('HGB');
    expect(hgb).toBeDefined();
    // Without gender, falls back to 'all' or first match
    expect(hgb!.normalRange).toBeDefined();

    const glu = getReferenceRange('GLU');
    expect(glu).toBeDefined();
    expect(glu!.normalRange.min).toBe(70);
    expect(glu!.normalRange.max).toBe(100);
    expect(glu!.unit).toBe('mg/dL');
  });

  it('2 — getReferenceRange returns gender-specific ranges for HGB', () => {
    const male = getReferenceRange('HGB', 'male');
    const female = getReferenceRange('HGB', 'female');

    expect(male).toBeDefined();
    expect(female).toBeDefined();
    expect(male!.normalRange.min).toBe(14.0);
    expect(male!.normalRange.max).toBe(18.0);
    expect(female!.normalRange.min).toBe(12.0);
    expect(female!.normalRange.max).toBe(16.0);
  });

  it('3 — getCategories returns all expected categories', () => {
    const categories = getCategories();
    expect(categories).toContain('CBC');
    expect(categories).toContain('BMP');
    expect(categories).toContain('LFT');
    expect(categories).toContain('LIPID');
    expect(categories).toContain('SPECIAL');
    expect(categories).toContain('URINALYSIS');
    expect(categories.length).toBeGreaterThanOrEqual(6);

    // Verify getRangesByCategory returns non-empty for each
    for (const cat of categories) {
      expect(getRangesByCategory(cat).length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// 2. Critical Values (scenarios 4-6)
// ===========================================================================

describe('Critical Values', () => {
  it('4 — checkCriticalValue detects critically high glucose (>500)', () => {
    const result = checkCriticalValue('GLU', 550);
    expect(result.isCritical).toBe(true);
    expect(result.type).toBe('HIGH');
    expect(result.threshold).toBe(500);

    // A normal glucose should not be critical
    const normal = checkCriticalValue('GLU', 90);
    expect(normal.isCritical).toBe(false);
  });

  it('5 — checkCriticalValue detects critically high potassium (>6.5)', () => {
    const result = checkCriticalValue('K', 7.0);
    expect(result.isCritical).toBe(true);
    expect(result.type).toBe('HIGH');
    expect(result.threshold).toBe(6.5);

    // Also check critically low potassium (<2.5)
    const low = checkCriticalValue('K', 2.0);
    expect(low.isCritical).toBe(true);
    expect(low.type).toBe('LOW');
    expect(low.threshold).toBe(2.5);
  });

  it('6 — isCriticalValue returns severity and bilingual message', () => {
    // Critical value
    const critical = isCriticalValue('GLU', 600);
    expect(critical.isCritical).toBe(true);
    expect(critical.severity).toBe('critical');
    expect(critical.message).toBeDefined();
    expect(critical.message!.en).toContain('Critical value');
    expect(critical.message!.ar).toContain('قيمة حرجة');

    // Abnormal value (outside normal but not critical)
    const abnormal = isCriticalValue('GLU', 130);
    expect(abnormal.isCritical).toBe(false);
    expect(abnormal.severity).toBe('abnormal');
    expect(abnormal.message!.en).toContain('Abnormal result');

    // Normal value
    const normal = isCriticalValue('GLU', 85);
    expect(normal.isCritical).toBe(false);
    expect(normal.severity).toBe('normal');
    expect(normal.message).toBeUndefined();
  });
});

// ===========================================================================
// 3. Auto-Validation (scenarios 7-9)
// ===========================================================================

describe('Auto-Validation', () => {
  it('7 — evaluateAutoValidation returns auto_verify for normal CBC result', () => {
    const input: ValidationInput = {
      testCode: 'WBC',
      value: 7.0, // within 4.5-11.0
      unit: '10^3/uL',
      qcStatus: 'pass',
    };

    const result = evaluateAutoValidation(input);
    expect(result.action).toBe('auto_verify');
    expect(result.ruleId).toBe('rule_cbc_auto');
    expect(result.allConditionsPassed).toBe(true);
  });

  it('8 — evaluateAutoValidation flags critical values as flag_critical', () => {
    const input: ValidationInput = {
      testCode: 'K',
      value: 7.5, // >6.5 critical threshold
      unit: 'mEq/L',
      qcStatus: 'pass',
    };

    const result = evaluateAutoValidation(input);
    expect(result.action).toBe('flag_critical');
    expect(result.allConditionsPassed).toBe(false);
    expect(result.conditionResults[0].condition).toBe('criticalValueCheck');
  });

  it('9 — evaluateAutoValidation falls back to hold_for_review for unmatched test', () => {
    const input: ValidationInput = {
      testCode: 'SOME_OBSCURE_TEST',
      value: 42,
      unit: 'units',
    };

    const result = evaluateAutoValidation(input);
    expect(result.action).toBe('hold_for_review');
    expect(result.ruleId).toBe('rule_fallback');
  });
});

// ===========================================================================
// 4. Panels (scenarios 10-12)
// ===========================================================================

describe('Panels', () => {
  it('10 — getPanelByCode("CBC") returns a panel with 8 tests', () => {
    const cbc = getPanelByCode('CBC');
    expect(cbc).toBeDefined();
    expect(cbc!.code).toBe('CBC');
    expect(cbc!.tests).toHaveLength(8);
    expect(cbc!.department).toBe('Hematology');
    expect(cbc!.tubeType).toBe('lavender');

    const testCodes = cbc!.tests.map((t) => t.testCode);
    expect(testCodes).toContain('WBC');
    expect(testCodes).toContain('RBC');
    expect(testCodes).toContain('HGB');
    expect(testCodes).toContain('PLT');
  });

  it('11 — getDepartments lists all departments', () => {
    const departments = getDepartments();
    expect(departments).toContain('Hematology');
    expect(departments).toContain('Chemistry');
    expect(departments).toContain('Urinalysis');
    expect(departments.length).toBeGreaterThanOrEqual(3);

    // Verify getPanelsByDepartment returns panels for each
    const chemPanels = getPanelsByDepartment('Chemistry');
    expect(chemPanels.length).toBeGreaterThan(0);
    expect(chemPanels.every((p) => p.department === 'Chemistry')).toBe(true);
  });

  it('12 — getRequiredTubes merges panels sharing the same tube type', () => {
    // BMP and LFT both use 'gold' tube
    const tubes = getRequiredTubes(['BMP', 'LFT']);
    expect(tubes).toHaveLength(1); // both gold SST, merged into one tube

    const goldTube = tubes.find((t) => t.tubeType === 'gold');
    expect(goldTube).toBeDefined();
    expect(goldTube!.panels).toContain('BMP');
    expect(goldTube!.panels).toContain('LFT');
    expect(goldTube!.totalVolume).toBe('10 mL'); // 5 mL + 5 mL

    // CBC (lavender) + BMP (gold) should produce 2 distinct tubes
    const twoTubes = getRequiredTubes(['CBC', 'BMP']);
    expect(twoTubes).toHaveLength(2);
    const tubeTypes = twoTubes.map((t) => t.tubeType);
    expect(tubeTypes).toContain('lavender');
    expect(tubeTypes).toContain('gold');
  });
});

// ===========================================================================
// 5. QC Westgard Rules (scenarios 13-15)
// ===========================================================================

describe('QC Westgard Rules', () => {
  it('13 — calculateZScore formula is correct', () => {
    // z = (value - mean) / sd
    expect(calculateZScore(110, 100, 5)).toBe(2);
    expect(calculateZScore(90, 100, 5)).toBe(-2);
    expect(calculateZScore(100, 100, 5)).toBe(0);

    // Edge case: SD = 0 should return 0
    expect(calculateZScore(110, 100, 0)).toBe(0);
  });

  it('14 — evaluateWestgard detects 1-3s violation (value > 3 SD from mean)', () => {
    // mean=100, sd=5 => value of 116 is 3.2 SD away => 1-3s reject
    const result = evaluateWestgard(116, 100, 5);
    expect(result.status).toBe('reject');
    expect(result.zScore).toBeCloseTo(3.2, 1);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);

    const has1_3s = result.violations.some((v) => v.rule === '1-3s');
    expect(has1_3s).toBe(true);

    const rejection = result.violations.find((v) => v.rule === '1-3s');
    expect(rejection!.severity).toBe('reject');
  });

  it('15 — evaluateWestgard passes for values within 2 SD', () => {
    // mean=100, sd=5 => value of 108 is 1.6 SD => pass
    const result = evaluateWestgard(108, 100, 5);
    expect(result.status).toBe('pass');
    expect(result.violations).toHaveLength(0);
    expect(result.zScore).toBeCloseTo(1.6, 1);

    // Value exactly at mean
    const exact = evaluateWestgard(100, 100, 5);
    expect(exact.status).toBe('pass');
    expect(exact.zScore).toBe(0);
  });
});

// ===========================================================================
// 6. Barcode (scenarios 16-17)
// ===========================================================================

describe('Barcode', () => {
  it('16 — generateAccessionNumber produces LAB-YYMMDD-NNNN format', () => {
    const acc = generateAccessionNumber(42, new Date(2026, 1, 17)); // Feb 17, 2026
    expect(acc.accession).toBe('LAB-260217-0042');
    expect(acc.date).toBe('260217');
    expect(acc.sequence).toBe(42);

    // Sequence 1 gets padded
    const acc1 = generateAccessionNumber(1, new Date(2026, 0, 5)); // Jan 5, 2026
    expect(acc1.accession).toBe('LAB-260105-0001');

    // Sequence > 9999 still works
    const big = generateAccessionNumber(12345, new Date(2026, 11, 31));
    expect(big.accession).toBe('LAB-261231-12345');
  });

  it('17 — parseAccessionNumber round-trips correctly', () => {
    const original = generateAccessionNumber(42, new Date(2026, 1, 17));
    const parsed = parseAccessionNumber(original.accession);

    expect(parsed).not.toBeNull();
    expect(parsed!.accession).toBe(original.accession);
    expect(parsed!.date).toBe(original.date);
    expect(parsed!.sequence).toBe(original.sequence);

    // Invalid accession returns null
    expect(parseAccessionNumber('INVALID')).toBeNull();
    expect(parseAccessionNumber('LAB-2602-17')).toBeNull();
    expect(parseAccessionNumber('')).toBeNull();
  });
});

// ===========================================================================
// 7. TAT Tracking (scenarios 18-19)
// ===========================================================================

describe('TAT Tracking', () => {
  it('18 — calculateTATBreakdown computes stage deltas in minutes', () => {
    const timestamps = {
      orderedAt: '2026-02-17T08:00:00Z',
      collectedAt: '2026-02-17T08:15:00Z',
      receivedAt: '2026-02-17T08:30:00Z',
      resultedAt: '2026-02-17T09:00:00Z',
      verifiedAt: '2026-02-17T09:10:00Z',
    };

    const breakdown = calculateTATBreakdown(timestamps);

    expect(breakdown.orderToCollect).toBe(15);
    expect(breakdown.collectToReceive).toBe(15);
    expect(breakdown.receiveToResult).toBe(30);
    expect(breakdown.resultToVerify).toBe(10);
    expect(breakdown.totalTAT).toBe(70); // 08:00 -> 09:10 = 70 min

    // getCurrentStage returns verified when all timestamps present
    expect(getCurrentStage(timestamps)).toBe('verified');

    // Partial timestamps
    const partial = { orderedAt: '2026-02-17T08:00:00Z', collectedAt: '2026-02-17T08:20:00Z' };
    expect(getCurrentStage(partial)).toBe('collected');

    // isTATExceeded
    expect(isTATExceeded(timestamps, 60)).toBe(true);  // 70 > 60
    expect(isTATExceeded(timestamps, 120)).toBe(false); // 70 < 120
  });

  it('19 — formatTAT handles hours and minutes', () => {
    expect(formatTAT(30)).toBe('30m');
    expect(formatTAT(60)).toBe('1h');
    expect(formatTAT(90)).toBe('1h 30m');
    expect(formatTAT(120)).toBe('2h');
    expect(formatTAT(145)).toBe('2h 25m');
    expect(formatTAT(undefined)).toBe('\u2014'); // em-dash
  });
});

// ===========================================================================
// 8. Route Wiring (scenario 20)
// ===========================================================================

describe('Route Wiring', () => {
  it('20 — all lab API routes use withAuthTenant', () => {
    const routePaths = [
      ['app', 'api', 'lab', 'orders', 'route.ts'],
      ['app', 'api', 'lab', 'results', 'route.ts'],
      ['app', 'api', 'lab', 'results', 'save', 'route.ts'],
      ['app', 'api', 'lab', 'specimens', 'route.ts'],
      ['app', 'api', 'lab', 'specimens', 'collect', 'route.ts'],
      ['app', 'api', 'lab', 'worklist', 'route.ts'],
      ['app', 'api', 'lab', 'critical-alerts', 'route.ts'],
      ['app', 'api', 'lab', 'auto-validate', 'route.ts'],
      ['app', 'api', 'lab', 'qc', 'route.ts'],
      ['app', 'api', 'lab', 'panels', 'route.ts'],
      ['app', 'api', 'lab', 'tat-metrics', 'route.ts'],
    ];

    for (const segments of routePaths) {
      const source = readRoute(...segments);
      const routeFile = segments.join('/');

      // Every lab route must be wrapped in withAuthTenant
      expect(
        source.includes('withAuthTenant'),
        `${routeFile} should use withAuthTenant`,
      ).toBe(true);
    }
  });
});
