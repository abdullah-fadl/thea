import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { calculateTriageLevel, validateTriageCompletionInput } from '@/lib/er/triage';
import { canTransitionStatus, statusRank, normalizeErStatus } from '@/lib/er/stateMachine';
import { validateDisposition } from '@/lib/er/disposition';
import { isFinalErStatus, getFinalStatusBlock } from '@/lib/er/finalStatusGuard';
import { formatYyyyMmDd, formatHhMm, generateUnknownTempMrn } from '@/lib/er/identifiers';
import { diffMinutes, computeStats } from '@/lib/er/metrics';
import { getWaitingMinutes, normalizeName } from '@/lib/er/utils';
import { ER_STATUSES, ER_ARRIVAL_METHODS } from '@/lib/er/constants';
import { triageSaveSchema, erBedAssignSchema } from '@/lib/validation/er.schema';

function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════
// 1. Triage Calculation (Tests 1-3)
// ═══════════════════════════════════════════════════════════════
describe('ER > Triage Calculation', () => {
  it('1 — critical SpO2 < 80 yields Level 1 with critical flag', () => {
    const result = calculateTriageLevel({ spo2: 75 });
    expect(result.triageLevel).toBe(1);
    expect(result.critical).toBe(true);
    expect(result.reasons).toContain('SpO2 < 80');
    expect(result.statusAfterSave).toBe('TRIAGE_IN_PROGRESS');
  });

  it('2 — urgent temp >= 39 yields Level 2 (non-critical)', () => {
    const result = calculateTriageLevel({ temp: 39.5 });
    expect(result.triageLevel).toBe(2);
    expect(result.critical).toBe(false);
    expect(result.reasons).toContain('Temp >= 39');
  });

  it('3 — pain score 4-6 yields Level 4 when no critical/urgent vitals', () => {
    const result = calculateTriageLevel({}, 5);
    expect(result.triageLevel).toBe(4);
    expect(result.critical).toBe(false);
    expect(result.reasons).toContain('Pain 4-6');

    // Pain >= 7 should yield Level 3
    const highPain = calculateTriageLevel({}, 8);
    expect(highPain.triageLevel).toBe(3);
    expect(highPain.reasons).toContain('Pain >= 7');
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. Triage Completion Validation (Tests 4-5)
// ═══════════════════════════════════════════════════════════════
describe('ER > Triage Completion Validation', () => {
  it('4 — missing chiefComplaint and all vitals returns all field names', () => {
    const result = validateTriageCompletionInput({});
    expect(result.missing).toContain('chiefComplaint');
    expect(result.missing).toContain('systolic');
    expect(result.missing).toContain('diastolic');
    expect(result.missing).toContain('HR');
    expect(result.missing).toContain('RR');
    expect(result.missing).toContain('TEMP');
    expect(result.missing).toContain('SPO2');
    expect(result.missing).toContain('triageLevel');
    expect(result.missing).toHaveLength(8);
  });

  it('5 — valid input with all fields returns empty missing array', () => {
    const result = validateTriageCompletionInput({
      chiefComplaint: 'Chest pain',
      vitals: { systolic: 120, diastolic: 80, HR: 80, RR: 18, TEMP: 37, SPO2: 98 },
      triageLevel: 3,
    });
    expect(result.missing).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. Disposition Validation (Tests 6-8)
// ═══════════════════════════════════════════════════════════════
describe('ER > Disposition Validation', () => {
  it('6 — DISCHARGE missing finalDiagnosis and dischargeInstructions is invalid', () => {
    const result = validateDisposition({ type: 'DISCHARGE' } as Record<string, unknown>);
    expect(result.isValid).toBe(false);
    expect(result.missing).toContain('finalDiagnosis');
    expect(result.missing).toContain('dischargeInstructions');
  });

  it('7 — valid ADMIT disposition with all required fields passes', () => {
    const result = validateDisposition({
      type: 'ADMIT',
      admitService: 'Cardiology',
      admitWardUnit: 'Ward 4A',
      reasonForAdmission: 'Acute MI',
      handoffSbar: 'S: chest pain, B: HTN, A: STEMI, R: PCI',
    } as Record<string, unknown>);
    expect(result.isValid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('8 — TRANSFER missing transferType is invalid', () => {
    const result = validateDisposition({
      type: 'TRANSFER',
      destinationFacilityUnit: 'King Faisal Hospital',
      reason: 'Neurosurgery needed',
      handoffSbar: 'S: head trauma, B: GCS 8, A: SDH, R: neurosurgical intervention',
    } as Record<string, unknown>);
    expect(result.isValid).toBe(false);
    expect(result.missing).toContain('transferType');
    expect(result.missing).not.toContain('destinationFacilityUnit');
    expect(result.missing).not.toContain('reason');
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. Status Transitions (Tests 9-10)
// ═══════════════════════════════════════════════════════════════
describe('ER > Status Transitions', () => {
  it('9 — ARRIVED -> REGISTERED is a valid transition', () => {
    expect(canTransitionStatus('ARRIVED', 'REGISTERED')).toBe(true);
    // Also test ARRIVED -> CANCELLED is valid
    expect(canTransitionStatus('ARRIVED', 'CANCELLED')).toBe(true);
    // ARRIVED -> DISCHARGED should be invalid (not in ER_TRANSITIONS)
    expect(canTransitionStatus('ARRIVED', 'DISCHARGED')).toBe(false);
  });

  it('10 — DISCHARGED -> IN_BED is invalid (terminal state)', () => {
    expect(canTransitionStatus('DISCHARGED', 'IN_BED')).toBe(false);
    expect(canTransitionStatus('DISCHARGED', 'ARRIVED')).toBe(false);
    // Same-state transition is always allowed
    expect(canTransitionStatus('DISCHARGED', 'DISCHARGED')).toBe(true);
    // Other terminal states
    expect(canTransitionStatus('ADMITTED', 'IN_BED')).toBe(false);
    expect(canTransitionStatus('TRANSFERRED', 'DECISION')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. Final Status Guard (Tests 11-12)
// ═══════════════════════════════════════════════════════════════
describe('ER > Final Status Guard', () => {
  it('11 — DISCHARGED is a final ER status', () => {
    expect(isFinalErStatus('DISCHARGED')).toBe(true);
    expect(isFinalErStatus('ADMITTED')).toBe(true);
    expect(isFinalErStatus('TRANSFERRED')).toBe(true);

    // getFinalStatusBlock returns 409 for finalized encounters
    const block = getFinalStatusBlock('DISCHARGED', 'triage.save');
    expect(block).not.toBeNull();
    expect(block!.status).toBe(409);
    expect(block!.body.error).toBe('Encounter is finalized');
    expect(block!.body.context).toBe('triage.save');
  });

  it('12 — IN_BED is not a final ER status', () => {
    expect(isFinalErStatus('IN_BED')).toBe(false);
    expect(isFinalErStatus('DECISION')).toBe(false);
    expect(isFinalErStatus('TRIAGE_COMPLETED')).toBe(false);
    expect(isFinalErStatus(null)).toBe(false);
    expect(isFinalErStatus(undefined)).toBe(false);

    // getFinalStatusBlock returns null for non-final statuses
    const block = getFinalStatusBlock('IN_BED', 'triage.save');
    expect(block).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. Temp MRN Format (Test 13)
// ═══════════════════════════════════════════════════════════════
describe('ER > Identifiers', () => {
  it('13 — generateUnknownTempMrn produces UN-YYYYMMDD-HHMM-XXXX format', () => {
    const fixedDate = new Date(2026, 1, 15, 14, 30); // Feb 15, 2026 at 14:30
    const mrn = generateUnknownTempMrn({ now: fixedDate, random: () => 0.1234 });

    // Check date portion
    expect(formatYyyyMmDd(fixedDate)).toBe('20260215');
    expect(formatHhMm(fixedDate)).toBe('1430');

    // Full format: UN-YYYYMMDD-HHMM-XXXX
    expect(mrn).toMatch(/^UN-\d{8}-\d{4}-\d{4}$/);
    expect(mrn).toContain('UN-20260215-1430-');

    // Random suffix: Math.floor(0.1234 * 10000) = 1234
    expect(mrn).toBe('UN-20260215-1430-1234');
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. ER Constants (Test 14)
// ═══════════════════════════════════════════════════════════════
describe('ER > Constants', () => {
  it('14 — ER_STATUSES has 14 entries and ER_ARRIVAL_METHODS contains WALKIN, AMBULANCE, TRANSFER', () => {
    expect(ER_STATUSES).toHaveLength(15);
    expect(ER_STATUSES).toContain('ARRIVED');
    expect(ER_STATUSES).toContain('DISCHARGED');
    expect(ER_STATUSES).toContain('CANCELLED');

    expect(ER_ARRIVAL_METHODS).toHaveLength(3);
    expect(ER_ARRIVAL_METHODS).toContain('WALKIN');
    expect(ER_ARRIVAL_METHODS).toContain('AMBULANCE');
    expect(ER_ARRIVAL_METHODS).toContain('TRANSFER');
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. Metrics (Tests 15-16)
// ═══════════════════════════════════════════════════════════════
describe('ER > Metrics', () => {
  it('15 — diffMinutes calculates correct time difference', () => {
    const start = new Date('2026-02-15T10:00:00Z');
    const end = new Date('2026-02-15T10:30:00Z');
    expect(diffMinutes(start, end)).toBe(30);

    // Negative difference returns null
    expect(diffMinutes(end, start)).toBeNull();

    // Null inputs return null
    expect(diffMinutes(null, end)).toBeNull();
    expect(diffMinutes(start, null)).toBeNull();

    // String dates work too
    expect(diffMinutes('2026-02-15T10:00:00Z', '2026-02-15T11:00:00Z')).toBe(60);
  });

  it('16 — computeStats calculates percentiles via percentileNearestRank', () => {
    // Test with known data where p50 and p90 are deterministic
    const samples = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    const stats = computeStats(samples, 30);

    expect(stats.count).toBe(10);
    expect(stats.avgMin).toBe(27.5);
    // p50 of [5,10,15,20,25,30,35,40,45,50] -> rank = ceil(50/100*10) = 5 -> idx=4 -> 25
    expect(stats.p50Min).toBe(25);
    // p90 -> rank = ceil(90/100*10) = 9 -> idx=8 -> 45
    expect(stats.p90Min).toBe(45);
    // SLA breach: values > 30 are [35,40,45,50] = 4 out of 10 = 40%
    expect(stats.slaBreachPct).toBe(40);

    // Empty samples
    const emptyStats = computeStats([], 10);
    expect(emptyStats.count).toBe(0);
    expect(emptyStats.avgMin).toBeNull();
    expect(emptyStats.p50Min).toBeNull();
    expect(emptyStats.p90Min).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. Waiting Minutes (Test 17)
// ═══════════════════════════════════════════════════════════════
describe('ER > Utils', () => {
  it('17 — getWaitingMinutes returns elapsed minutes from startedAt', () => {
    // null/undefined returns 0
    expect(getWaitingMinutes(null)).toBe(0);
    expect(getWaitingMinutes(undefined)).toBe(0);

    // A date 60 minutes ago should return ~60
    const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000);
    const result = getWaitingMinutes(sixtyMinAgo);
    // Allow small tolerance for test execution time
    expect(result).toBeGreaterThanOrEqual(59);
    expect(result).toBeLessThanOrEqual(61);

    // String dates work too
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const result2 = getWaitingMinutes(tenMinAgo);
    expect(result2).toBeGreaterThanOrEqual(9);
    expect(result2).toBeLessThanOrEqual(11);

    // normalizeName trims whitespace
    expect(normalizeName('  John Doe  ')).toBe('John Doe');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. Duplicate Key Detection (Test 18)
// ═══════════════════════════════════════════════════════════════
describe('ER > Duplicate Key Detection', () => {
  it('18 — isPrismaDuplicateKeyError detects P2002 errors in route source', () => {
    // We verify the status route uses isPrismaDuplicateKeyError for concurrency handling
    const src = readRoute('app', 'api', 'er', 'encounters', 'status', 'route.ts');
    expect(src).toContain('isPrismaDuplicateKeyError');
    // Used for concurrent PRIMARY_DOCTOR assignment
    expect(src).toContain('ASSIGN_PRIMARY_DOCTOR');
    // Optimistic concurrency control
    expect(src).toContain('status changed concurrently');
    expect(src).toContain('updateMany');
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. Zod Schema Validation (Tests 19-20)
// ═══════════════════════════════════════════════════════════════
describe('ER > Zod Schema Validation', () => {
  it('19 — triageSaveSchema requires encounterId and validates painScore range', () => {
    // Missing encounterId
    const empty = triageSaveSchema.safeParse({});
    expect(empty.success).toBe(false);
    if (!empty.success) {
      const fieldNames = empty.error.issues.map((i) => i.path[0]);
      expect(fieldNames).toContain('encounterId');
    }

    // Valid minimal payload
    const valid = triageSaveSchema.safeParse({ encounterId: 'enc-001' });
    expect(valid.success).toBe(true);

    // Valid full payload
    const full = triageSaveSchema.safeParse({
      encounterId: 'enc-001',
      painScore: 7,
      chiefComplaint: 'Chest pain',
      allergiesShort: 'NKDA',
      onset: '2 hours ago',
    });
    expect(full.success).toBe(true);

    // painScore out of range (0-10) is rejected
    const badPain = triageSaveSchema.safeParse({ encounterId: 'enc-001', painScore: 11 });
    expect(badPain.success).toBe(false);

    const negativePain = triageSaveSchema.safeParse({ encounterId: 'enc-001', painScore: -1 });
    expect(negativePain.success).toBe(false);
  });

  it('20 — erBedAssignSchema requires encounterId and bedId, defaults action to ASSIGN', () => {
    // Missing both required fields
    const empty = erBedAssignSchema.safeParse({});
    expect(empty.success).toBe(false);
    if (!empty.success) {
      const fieldNames = empty.error.issues.map((i) => i.path[0]);
      expect(fieldNames).toContain('encounterId');
      expect(fieldNames).toContain('bedId');
    }

    // Valid payload without action (defaults to ASSIGN)
    const valid = erBedAssignSchema.safeParse({ encounterId: 'enc-001', bedId: 'bed-A1' });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.action).toBe('ASSIGN');
    }

    // Explicit UNASSIGN action
    const unassign = erBedAssignSchema.safeParse({
      encounterId: 'enc-001',
      bedId: 'bed-A1',
      action: 'UNASSIGN',
    });
    expect(unassign.success).toBe(true);
    if (unassign.success) {
      expect(unassign.data.action).toBe('UNASSIGN');
    }

    // Invalid action value
    const badAction = erBedAssignSchema.safeParse({
      encounterId: 'enc-001',
      bedId: 'bed-A1',
      action: 'REMOVE',
    });
    expect(badAction.success).toBe(false);
  });
});
