import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  createMedOrderSchema,
  medOrderTypeEnum,
  medFrequencyEnum,
  medOrderStatusEnum,
  ipdVitalsSchema,
  avpuEnum,
  nursingProgressSchema,
  createCarePlanSchema,
  carePlanStatusEnum,
  icuAdmitSchema,
  icuTransferSchema,
  icuDestinationEnum,
  narcoticCountSchema,
  admissionIntakeSchema,
  ipdBedAssignSchema,
  doctorProgressSchema,
} from '@/lib/validation/ipd.schema';
import { computeMarDue } from '@/lib/ipd/marDue';
import { buildMedicationSafetyFlags } from '@/lib/ipd/medSafety';

function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: Med Order Schema (IPD-01 .. IPD-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('IPD — Med Order Schema', () => {
  // IPD-01: valid STAT medication order
  it('IPD-01: createMedOrderSchema accepts a valid STAT order', () => {
    const valid = {
      medicationName: 'Paracetamol 500mg',
      orderType: 'STAT',
      doseValue: '500',
      doseUnit: 'mg',
      route: 'PO',
      orderingDoctorId: 'doc-001',
      idempotencyKey: 'idem-med-001',
    };
    const result = createMedOrderSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderType).toBe('STAT');
      expect(result.data.route).toBe('PO');
      expect(result.data.doseValue).toBe('500');
      expect(result.data.doseUnit).toBe('mg');
      expect(result.data.isNarcotic).toBeUndefined();
    }
  });

  // IPD-02: missing doseValue should fail
  it('IPD-02: createMedOrderSchema rejects when doseValue is missing', () => {
    const missing = {
      medicationName: 'Amoxicillin',
      orderType: 'SCHEDULED',
      doseUnit: 'mg',
      route: 'PO',
      frequency: 'Q8H',
      orderingDoctorId: 'doc-002',
      idempotencyKey: 'idem-med-002',
    };
    const result = createMedOrderSchema.safeParse(missing);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join('.'));
      expect(fields).toContain('doseValue');
    }
  });

  // IPD-03: invalid route value should fail
  it('IPD-03: createMedOrderSchema rejects an invalid medication route', () => {
    const invalid = {
      medicationName: 'Aspirin',
      orderType: 'PRN',
      doseValue: '100',
      doseUnit: 'mg',
      route: 'RECTAL',
      orderingDoctorId: 'doc-003',
      idempotencyKey: 'idem-med-003',
    };
    const result = createMedOrderSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join('.'));
      expect(fields).toContain('route');
    }

    // Verify all valid route values
    const validRoutes = ['PO', 'IV', 'IM', 'SC', 'INH', 'LOCAL'];
    validRoutes.forEach((r) => {
      const base = {
        orderType: 'STAT',
        doseValue: '10',
        doseUnit: 'mg',
        route: r,
        orderingDoctorId: 'doc-x',
        idempotencyKey: `k-${r}`,
      };
      expect(createMedOrderSchema.safeParse(base).success).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: IPD Vitals Schema (IPD-04 .. IPD-05)
// ─────────────────────────────────────────────────────────────────────────────
describe('IPD — Vitals Schema', () => {
  // IPD-04: valid vitals entry
  it('IPD-04: ipdVitalsSchema accepts valid vitals data', () => {
    const valid = {
      systolic: 120,
      diastolic: 80,
      hr: 72,
      rr: 16,
      temp: 37.0,
      spo2: 98,
      painScore: 3,
      avpu: 'A',
    };
    const result = ipdVitalsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.systolic).toBe(120);
      expect(result.data.avpu).toBe('A');
      expect(result.data.painScore).toBe(3);
    }
  });

  // IPD-05: painScore out of range (0-10)
  it('IPD-05: ipdVitalsSchema rejects painScore outside 0-10 range', () => {
    const tooHigh = {
      systolic: 120,
      diastolic: 80,
      hr: 72,
      rr: 16,
      temp: 37.0,
      spo2: 98,
      painScore: 11,
      avpu: 'A',
    };
    expect(ipdVitalsSchema.safeParse(tooHigh).success).toBe(false);

    const negative = {
      systolic: 120,
      diastolic: 80,
      hr: 72,
      rr: 16,
      temp: 37.0,
      spo2: 98,
      painScore: -1,
      avpu: 'V',
    };
    expect(ipdVitalsSchema.safeParse(negative).success).toBe(false);

    // Boundary: 0 and 10 should both pass
    const atZero = { ...tooHigh, painScore: 0 };
    expect(ipdVitalsSchema.safeParse(atZero).success).toBe(true);

    const atTen = { ...tooHigh, painScore: 10 };
    expect(ipdVitalsSchema.safeParse(atTen).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: Care Plan Schema (IPD-06 .. IPD-07)
// ─────────────────────────────────────────────────────────────────────────────
describe('IPD — Care Plan Schema', () => {
  // IPD-06: valid plan with defaults
  it('IPD-06: createCarePlanSchema accepts valid plan and defaults status to ACTIVE', () => {
    const valid = {
      problem: 'Post-operative pain management',
      goals: 'Pain score < 4 within 24h',
      interventions: 'PCA morphine, ice packs, positioning',
    };
    const result = createCarePlanSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('ACTIVE');
      expect(result.data.problem).toBe('Post-operative pain management');
      expect(result.data.goals).toBe('Pain score < 4 within 24h');
    }

    // Verify status enum values
    expect(carePlanStatusEnum.safeParse('ACTIVE').success).toBe(true);
    expect(carePlanStatusEnum.safeParse('RESOLVED').success).toBe(true);
    expect(carePlanStatusEnum.safeParse('CANCELLED').success).toBe(false);
  });

  // IPD-07: missing problem should fail
  it('IPD-07: createCarePlanSchema rejects when problem is missing', () => {
    const noProblem = {
      goals: 'Stabilize vitals',
      interventions: 'Monitor Q4H',
    };
    const result = createCarePlanSchema.safeParse(noProblem);
    expect(result.success).toBe(false);

    // Empty string should also fail (min 1)
    const emptyProblem = { problem: '' };
    expect(createCarePlanSchema.safeParse(emptyProblem).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: ICU Schemas (IPD-08 .. IPD-09)
// ─────────────────────────────────────────────────────────────────────────────
describe('IPD — ICU Schemas', () => {
  // IPD-08: valid ICU admit
  it('IPD-08: icuAdmitSchema accepts valid admit with optional fields', () => {
    const valid = {
      source: 'ER',
      note: 'Hemodynamically unstable, requires vasopressors',
    };
    const result = icuAdmitSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe('ER');
      expect(result.data.note).toBe('Hemodynamically unstable, requires vasopressors');
    }

    // Empty object should pass (both fields are optional)
    const empty = {};
    expect(icuAdmitSchema.safeParse(empty).success).toBe(true);
  });

  // IPD-09: ICU transfer with destination enum
  it('IPD-09: icuTransferSchema requires destination from icuDestinationEnum', () => {
    const valid = {
      destination: 'WARD',
      note: 'Patient stable, transferring to medical ward',
    };
    const result = icuTransferSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.destination).toBe('WARD');
    }

    // All valid destinations
    const validDests = ['WARD', 'ICU', 'DISCHARGE'];
    validDests.forEach((d) => {
      expect(icuDestinationEnum.safeParse(d).success).toBe(true);
    });
    expect(icuDestinationEnum.safeParse('OR').success).toBe(false);

    // Missing destination should fail
    const noDestination = { note: 'test' };
    expect(icuTransferSchema.safeParse(noDestination).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: Narcotic Count Schema (IPD-10)
// ─────────────────────────────────────────────────────────────────────────────
describe('IPD — Narcotic Count Schema', () => {
  // IPD-10: valid narcotic count with dual verification
  it('IPD-10: narcoticCountSchema requires count, countedBy, and verifiedBy', () => {
    const valid = {
      count: 12,
      countedBy: 'nurse-001',
      verifiedBy: 'nurse-002',
    };
    const result = narcoticCountSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.count).toBe(12);
      expect(result.data.countedBy).toBe('nurse-001');
      expect(result.data.verifiedBy).toBe('nurse-002');
    }

    // count=0 should pass (min is 0)
    const zero = { count: 0, countedBy: 'n1', verifiedBy: 'n2' };
    expect(narcoticCountSchema.safeParse(zero).success).toBe(true);

    // Negative count should fail
    const negative = { count: -1, countedBy: 'n1', verifiedBy: 'n2' };
    expect(narcoticCountSchema.safeParse(negative).success).toBe(false);

    // Missing verifiedBy should fail
    const noVerifier = { count: 5, countedBy: 'n1' };
    expect(narcoticCountSchema.safeParse(noVerifier).success).toBe(false);

    // Empty countedBy should fail (min 1)
    const emptyCounter = { count: 5, countedBy: '', verifiedBy: 'n2' };
    expect(narcoticCountSchema.safeParse(emptyCounter).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 6: computeMarDue (IPD-11 .. IPD-12)
// ─────────────────────────────────────────────────────────────────────────────
describe('IPD — computeMarDue', () => {
  // IPD-11: STAT orders are due immediately at startAt / createdAt
  it('IPD-11: STAT orders appear as due at their startAt time', () => {
    const now = new Date('2025-06-01T12:00:00Z');
    const orders = [
      {
        id: 'ord-stat-1',
        drugName: 'Epinephrine',
        route: 'IV',
        type: 'STAT',
        status: 'ACTIVE',
        startAt: null,
        createdAt: new Date('2025-06-01T11:30:00Z').toISOString(),
        schedule: null,
        endAt: null,
      },
    ];
    const result = computeMarDue({
      orders,
      latestByOrder: {},
      windowEvents: [],
      now,
    });

    expect(result.due.length).toBe(1);
    expect(result.due[0].orderId).toBe('ord-stat-1');
    expect(result.due[0].type).toBe('STAT');
    // 30 minutes past, beyond 1h grace => not yet overdue
    expect(result.due[0].overdue).toBe(false);
    expect(result.prn.length).toBe(0);
  });

  // IPD-12: scheduled Q6H orders generate multiple due entries
  it('IPD-12: Q6H scheduled orders generate due entries every 6 hours in the window', () => {
    const now = new Date('2025-06-01T12:00:00Z');
    const orders = [
      {
        id: 'ord-sched-1',
        drugName: 'Ceftriaxone',
        route: 'IV',
        type: 'SCHEDULED',
        status: 'ACTIVE',
        startAt: new Date('2025-06-01T00:00:00Z').toISOString(),
        createdAt: new Date('2025-06-01T00:00:00Z').toISOString(),
        schedule: 'Q6H',
        endAt: null,
      },
    ];
    const result = computeMarDue({
      orders,
      latestByOrder: {},
      windowEvents: [],
      now,
    });

    // Window is now-24h to now+24h => June 1 00:00 already within window start (May 31 12:00)
    // Q6H from June 1 00:00 => 00:00, 06:00, 12:00, 18:00, June 2 00:00, 06:00
    // Window: May 31 12:00 to June 2 12:00
    // Due entries at: 00:00, 06:00, 12:00, 18:00, June 2 00:00, 06:00, 12:00
    expect(result.due.length).toBe(7);
    expect(result.due[0].schedule).toBe('Q6H');
    expect(result.due[0].orderId).toBe('ord-sched-1');

    // First two entries (00:00, 06:00) should be overdue (> 1h grace past now=12:00)
    const overdueEntries = result.due.filter((d) => d.overdue);
    expect(overdueEntries.length).toBe(2);
    expect(result.overdueCountByOrder['ord-sched-1']).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 7: buildMedicationSafetyFlags (IPD-13 .. IPD-14)
// ─────────────────────────────────────────────────────────────────────────────
describe('IPD — buildMedicationSafetyFlags', () => {
  // IPD-13: allergy conflict detection
  it('IPD-13: flags allergyConflict when drug name contains a known allergy', () => {
    const orders = [
      { id: 'o1', drugName: 'Amoxicillin 500mg', route: 'PO', type: 'SCHEDULED', schedule: 'Q8H' },
      { id: 'o2', drugName: 'Paracetamol 1g', route: 'PO', type: 'PRN', schedule: '' },
    ];
    const allergies = ['amoxicillin', 'sulfa'];

    const flags = buildMedicationSafetyFlags(orders, allergies);

    expect(flags['o1'].allergyConflict).toBe(true);
    expect(flags['o2'].allergyConflict).toBe(false);
    expect(flags['o1'].highRisk).toBe(false);
    expect(flags['o2'].highRisk).toBe(false);
  });

  // IPD-14: high-risk drug flagging
  it('IPD-14: flags highRisk for known high-risk medications', () => {
    const orders = [
      { id: 'h1', drugName: 'Heparin 5000 units', route: 'IV', type: 'SCHEDULED', schedule: 'Q12H' },
      { id: 'h2', drugName: 'Insulin Glargine', route: 'SC', type: 'SCHEDULED', schedule: 'Q24H' },
      { id: 'h3', drugName: 'Omeprazole 40mg', route: 'PO', type: 'SCHEDULED', schedule: 'Q24H' },
      { id: 'h4', drugName: 'Morphine Sulfate 10mg', route: 'IV', type: 'PRN', schedule: '' },
      { id: 'h5', drugName: 'Potassium Chloride 20mEq', route: 'IV', type: 'STAT', schedule: '' },
    ];

    const flags = buildMedicationSafetyFlags(orders, []);

    expect(flags['h1'].highRisk).toBe(true);  // heparin
    expect(flags['h2'].highRisk).toBe(true);  // insulin
    expect(flags['h3'].highRisk).toBe(false); // omeprazole (not high-risk)
    expect(flags['h4'].highRisk).toBe(true);  // morphine
    expect(flags['h5'].highRisk).toBe(true);  // potassium chloride

    // Verify duplicate detection works for orders with same drug/route/type/schedule
    const dupOrders = [
      { id: 'd1', drugName: 'Ceftriaxone 1g', route: 'IV', type: 'SCHEDULED', schedule: 'Q12H' },
      { id: 'd2', drugName: 'Ceftriaxone 1g', route: 'IV', type: 'SCHEDULED', schedule: 'Q12H' },
    ];
    const dupFlags = buildMedicationSafetyFlags(dupOrders, []);
    expect(dupFlags['d1'].duplicateWarning).toBe(true);
    expect(dupFlags['d2'].duplicateWarning).toBe(true);
    expect(dupFlags['d1'].existingOrderIds).toContain('d2');
    expect(dupFlags['d2'].existingOrderIds).toContain('d1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 8: Nursing Progress & Admission Intake Schemas (IPD-15 .. IPD-16)
// ─────────────────────────────────────────────────────────────────────────────
describe('IPD — Nursing Progress & Admission Intake', () => {
  // IPD-15: nursingProgressSchema validation
  it('IPD-15: nursingProgressSchema rejects when responseToCarePlan is missing', () => {
    const valid = {
      responseToCarePlan: 'Patient responding well to pain management plan',
      vitalsSummary: 'BP stable, HR 74',
      issues: 'None',
    };
    const result = nursingProgressSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.responseToCarePlan).toBe('Patient responding well to pain management plan');
      expect(result.data.escalations).toBeUndefined();
    }

    // Missing responseToCarePlan
    const noResponse = { vitalsSummary: 'All normal' };
    expect(nursingProgressSchema.safeParse(noResponse).success).toBe(false);

    // Empty responseToCarePlan
    const emptyResponse = { responseToCarePlan: '' };
    expect(nursingProgressSchema.safeParse(emptyResponse).success).toBe(false);
  });

  // IPD-16: admissionIntakeSchema requires handoffId
  it('IPD-16: admissionIntakeSchema requires handoffId and allows passthrough', () => {
    const valid = { handoffId: 'handoff-abc-123' };
    const result = admissionIntakeSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.handoffId).toBe('handoff-abc-123');
    }

    // Missing handoffId
    expect(admissionIntakeSchema.safeParse({}).success).toBe(false);

    // Empty handoffId
    expect(admissionIntakeSchema.safeParse({ handoffId: '' }).success).toBe(false);

    // Passthrough allows extra fields
    const withExtra = { handoffId: 'h-1', extraField: 'any-value' };
    const passthroughResult = admissionIntakeSchema.safeParse(withExtra);
    expect(passthroughResult.success).toBe(true);
    if (passthroughResult.success) {
      expect((passthroughResult.data as Record<string, unknown>).extraField).toBe('any-value');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 9: Route File Checks (IPD-17 .. IPD-18)
// ─────────────────────────────────────────────────────────────────────────────
describe('IPD — Route File Guards', () => {
  // IPD-17: med-orders route uses withAuthTenant
  it('IPD-17: med-orders route is wrapped with withAuthTenant and imports createMedOrderSchema', () => {
    const src = readRoute('app', 'api', 'ipd', 'episodes', '[episodeId]', 'med-orders', 'route.ts');
    expect(src).toContain('withAuthTenant');
    expect(src).toContain("from '@/lib/core/guards/withAuthTenant'");
    expect(src).toContain('createMedOrderSchema');
    expect(src).toContain("from '@/lib/validation/ipd.schema'");
    // Uses computeMarDue and buildMedicationSafetyFlags
    expect(src).toContain('computeMarDue');
    expect(src).toContain('buildMedicationSafetyFlags');
    // Uses ensureNotDeceasedFinalized guard
    expect(src).toContain('ensureNotDeceasedFinalized');
  });

  // IPD-18: vitals route uses withErrorHandler
  it('IPD-18: vitals route is wrapped with withErrorHandler and validates ipdVitalsSchema', () => {
    const src = readRoute('app', 'api', 'ipd', 'episodes', '[episodeId]', 'vitals', 'route.ts');
    expect(src).toContain('withErrorHandler');
    expect(src).toContain("from '@/lib/core/errors'");
    expect(src).toContain('ipdVitalsSchema');
    expect(src).toContain("from '@/lib/validation/ipd.schema'");
    // Verifies evaluateCriticalVitals is used
    expect(src).toContain('evaluateCriticalVitals');
    // Audit log written
    expect(src).toContain('writeErAuditLog');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 10: Bed Assign & Doctor Progress Schemas (IPD-19 .. IPD-20)
// ─────────────────────────────────────────────────────────────────────────────
describe('IPD — Bed Assign & Doctor Progress', () => {
  // IPD-19: ipdBedAssignSchema validation
  it('IPD-19: ipdBedAssignSchema requires bedId and rejects empty strings', () => {
    const valid = { bedId: 'bed-101' };
    const result = ipdBedAssignSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bedId).toBe('bed-101');
    }

    // Missing bedId
    expect(ipdBedAssignSchema.safeParse({}).success).toBe(false);

    // Empty string should fail (min 1)
    expect(ipdBedAssignSchema.safeParse({ bedId: '' }).success).toBe(false);

    // Verify the bed assign route imports this schema
    const src = readRoute('app', 'api', 'ipd', 'episodes', '[episodeId]', 'bed', 'assign', 'route.ts');
    expect(src).toContain('ipdBedAssignSchema');
    expect(src).toContain('withAuthTenant');
  });

  // IPD-20: doctorProgressSchema with passthrough
  it('IPD-20: doctorProgressSchema requires content and allows passthrough of extra fields', () => {
    const valid = {
      content: 'Patient improving. Continue current management.',
      type: 'SHIFT_NOTE',
    };
    const result = doctorProgressSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe('Patient improving. Continue current management.');
      expect(result.data.type).toBe('SHIFT_NOTE');
    }

    // type is optional
    const noType = { content: 'Day 2 progress note' };
    const noTypeResult = doctorProgressSchema.safeParse(noType);
    expect(noTypeResult.success).toBe(true);

    // Empty content should fail (min 1)
    expect(doctorProgressSchema.safeParse({ content: '' }).success).toBe(false);

    // Missing content entirely
    expect(doctorProgressSchema.safeParse({}).success).toBe(false);

    // Passthrough allows extra fields
    const withExtra = { content: 'Progress note', assessment: 'Stable', plan: 'Continue IV ABx' };
    const passthroughResult = doctorProgressSchema.safeParse(withExtra);
    expect(passthroughResult.success).toBe(true);
    if (passthroughResult.success) {
      expect((passthroughResult.data as Record<string, unknown>).assessment).toBe('Stable');
      expect((passthroughResult.data as Record<string, unknown>).plan).toBe('Continue IV ABx');
    }
  });
});
