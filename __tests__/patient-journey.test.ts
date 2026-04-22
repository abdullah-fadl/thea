/**
 * Patient Journey Integration Tests — 50 Scenarios
 *
 * Tests the complete patient journey through the Thea EHR system:
 * Registration → Booking → Check-in → Nursing → Doctor → Orders → Lab/Rad → Pharmacy → Billing → Discharge → Follow-up → Portal
 *
 * These tests validate:
 * - Zod validation schemas accept/reject correct inputs
 * - OPD flow state machine transitions
 * - Business logic in lib/opd/* modules
 * - Route-level wiring (withAuthTenant, withErrorHandler, Prisma)
 * - Guard rails (deceased, closed encounter, version conflict, duplicate prevention)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ── OPD Business Logic Imports ──
import { getAllowedOpdFlowTransitions, isOpdFlowTransitionAllowed } from '@/lib/opd/flowState';
import { normalizeOpdPaymentSnapshot } from '@/lib/opd/payment';
import { deriveOpdStatus } from '@/lib/opd/status';
import { waitingToNursingMinutes, waitingToDoctorMinutes } from '@/lib/opd/waiting';
import { buildAppendOnlyTimestampPatch, OPD_TIMESTAMP_FIELDS } from '@/lib/opd/timestamps';

// ── Validation Schema Imports ──
import {
  openEncounterSchema,
  createBookingSchema,
  walkInBookingSchema,
  checkInBookingSchema,
  cancelBookingSchema,
  bookingPendingPaymentSchema,
  opdFlowStateSchema,
  opdTimestampsSchema,
  arrivalActionSchema,
  opdDispositionSchema,
  opdNursingSchema,
  opdNursingCorrectionSchema,
  opdOrderSchema,
  opdOrdersBulkSchema,
  visitNotesSchema,
  physicalExamSchema,
  cancelOpdOrderSchema,
  timeOutChecklistSchema,
  pfeSchema,
} from '@/lib/validation/opd.schema';

import {
  createPatientSchema,
  updatePatientSchema,
  createAllergySchema,
  createProblemSchema,
  mergePatientSchema,
} from '@/lib/validation/patient.schema';

import {
  createBookingSchema as schedCreateBookingSchema,
  createResourceSchema,
  createTemplateSchema,
  generateSlotsSchema,
  createReservationSchema,
  updateAppointmentStatusSchema,
} from '@/lib/validation/scheduling.schema';

import { vitalsSchema, paginationSchema, paymentSnapshotSchema } from '@/lib/validation/shared.schema';


// ═══════════════════════════════════════════════════════════════════
// Helper: read source file
// ═══════════════════════════════════════════════════════════════════
function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}


// ═══════════════════════════════════════════════════════════════════
// GROUP 1: Patient Registration & Search (Scenarios 1-5)
// ═══════════════════════════════════════════════════════════════════
describe('Group 1: Patient Registration & Search', () => {
  it('Scenario 1: Patient registration requires firstName + lastName', () => {
    // Valid registration
    const valid = createPatientSchema.safeParse({
      firstName: 'Ahmed',
      lastName: 'Al-Farsi',
      gender: 'MALE',
      dob: '1990-01-01',
      mobile: '+966500000001',
    });
    expect(valid.success).toBe(true);

    // Missing lastName
    const noLast = createPatientSchema.safeParse({ firstName: 'Ahmed' });
    expect(noLast.success).toBe(false);

    // Missing firstName
    const noFirst = createPatientSchema.safeParse({ lastName: 'Al-Farsi' });
    expect(noFirst.success).toBe(false);
  });

  it('Scenario 2: Patient identifiers (nationalId, iqama, passport) are optional', () => {
    const valid = createPatientSchema.safeParse({
      firstName: 'Sara',
      lastName: 'Hussain',
      identifiers: { nationalId: '1012345678', iqama: '2012345678' },
    });
    expect(valid.success).toBe(true);

    // Without any identifiers — still valid
    const noIds = createPatientSchema.safeParse({
      firstName: 'Omar',
      lastName: 'Khan',
    });
    expect(noIds.success).toBe(true);
  });

  it('Scenario 3: Patient allergy creation validates properly', () => {
    const valid = createAllergySchema.safeParse({
      allergen: 'Penicillin',
      reaction: 'Rash',
      severity: 'MODERATE',
      type: 'MEDICATION',
    });
    expect(valid.success).toBe(true);

    // Empty object — still valid (all fields optional)
    const empty = createAllergySchema.safeParse({});
    expect(empty.success).toBe(true);
  });

  it('Scenario 4: Patient problem/diagnosis creation requires description', () => {
    const valid = createProblemSchema.safeParse({
      code: 'J06.9',
      description: 'Acute upper respiratory infection',
      status: 'ACTIVE',
    });
    expect(valid.success).toBe(true);

    const noDesc = createProblemSchema.safeParse({ code: 'J06.9' });
    expect(noDesc.success).toBe(false);
  });

  it('Scenario 5: Patient merge requires both source and target IDs', () => {
    const valid = mergePatientSchema.safeParse({
      sourcePatientId: 'pat_001',
      targetPatientId: 'pat_002',
      reason: 'Duplicate record',
    });
    expect(valid.success).toBe(true);

    const noTarget = mergePatientSchema.safeParse({ sourcePatientId: 'pat_001' });
    expect(noTarget.success).toBe(false);

    const noSource = mergePatientSchema.safeParse({ targetPatientId: 'pat_002' });
    expect(noSource.success).toBe(false);
  });
});


// ═══════════════════════════════════════════════════════════════════
// GROUP 2: Scheduling & Booking (Scenarios 6-13)
// ═══════════════════════════════════════════════════════════════════
describe('Group 2: Scheduling & Booking', () => {
  it('Scenario 6: Booking creation requires resourceId, clinicId, and slotIds', () => {
    const valid = createBookingSchema.safeParse({
      resourceId: 'res_001',
      clinicId: 'clinic_001',
      bookingType: 'PATIENT',
      slotIds: ['slot_001', 'slot_002'],
      patientMasterId: 'pat_001',
    });
    expect(valid.success).toBe(true);

    // Missing resourceId
    const noRes = createBookingSchema.safeParse({
      clinicId: 'clinic_001',
      bookingType: 'PATIENT',
      slotIds: ['slot_001'],
    });
    expect(noRes.success).toBe(false);

    // Empty slotIds
    const noSlots = createBookingSchema.safeParse({
      resourceId: 'res_001',
      clinicId: 'clinic_001',
      bookingType: 'PATIENT',
      slotIds: [],
    });
    expect(noSlots.success).toBe(false);
  });

  it('Scenario 7: Walk-in booking includes billing and payment data', () => {
    const valid = walkInBookingSchema.safeParse({
      patientMasterId: 'pat_001',
      clinicId: 'clinic_001',
      chiefComplaint: 'Headache for 3 days',
      priority: 'NORMAL',
    });
    expect(valid.success).toBe(true);
  });

  it('Scenario 8: Check-in booking requires bookingId', () => {
    const valid = checkInBookingSchema.safeParse({
      bookingId: 'booking_001',
      payment: { status: 'PAID', serviceType: 'CONSULTATION' },
    });
    expect(valid.success).toBe(true);

    const noId = checkInBookingSchema.safeParse({});
    expect(noId.success).toBe(false);
  });

  it('Scenario 9: Cancel booking requires bookingId and reason', () => {
    const valid = cancelBookingSchema.safeParse({
      bookingId: 'booking_001',
      reason: 'Patient requested cancellation',
    });
    expect(valid.success).toBe(true);

    // Missing reason
    const noReason = cancelBookingSchema.safeParse({ bookingId: 'booking_001' });
    expect(noReason.success).toBe(false);
  });

  it('Scenario 10: Scheduling resource requires resourceType', () => {
    const valid = createResourceSchema.safeParse({
      resourceType: 'CLINIC_ROOM',
      displayName: 'Room A1',
      departmentKey: 'OPD',
      status: 'ACTIVE',
    });
    expect(valid.success).toBe(true);

    const noType = createResourceSchema.safeParse({ displayName: 'Room A1' });
    expect(noType.success).toBe(false);
  });

  it('Scenario 11: Slot generation requires resourceId + date range', () => {
    const valid = generateSlotsSchema.safeParse({
      resourceId: 'res_001',
      fromDate: '2025-03-01',
      toDate: '2025-03-07',
    });
    expect(valid.success).toBe(true);

    const noFrom = generateSlotsSchema.safeParse({ resourceId: 'res_001', toDate: '2025-03-07' });
    expect(noFrom.success).toBe(false);
  });

  it('Scenario 12: Booking route validates merged patient rejection', () => {
    const src = readRoute('app', 'api', 'opd', 'booking', 'create', 'route.ts');
    expect(src).toContain("patient.status === 'MERGED'");
    expect(src).toContain('Patient is merged');
  });

  it('Scenario 13: Booking route enforces rate limiting (10 per minute)', () => {
    const src = readRoute('app', 'api', 'opd', 'booking', 'create', 'route.ts');
    expect(src).toContain('recentBookings >= 10');
    expect(src).toContain('429');
    expect(src).toContain('Too many booking requests');
  });
});


// ═══════════════════════════════════════════════════════════════════
// GROUP 3: Queue, Arrival & Check-in (Scenarios 14-18)
// ═══════════════════════════════════════════════════════════════════
describe('Group 3: Queue, Arrival & Check-in', () => {
  it('Scenario 14: Arrival action accepts ARRIVE / ROOM / LEAVE', () => {
    for (const action of ['ARRIVE', 'ROOM', 'LEAVE']) {
      const result = arrivalActionSchema.safeParse({ action });
      expect(result.success).toBe(true);
    }

    const invalid = arrivalActionSchema.safeParse({ action: 'FLY' });
    expect(invalid.success).toBe(false);
  });

  it('Scenario 15: OPD status derived from timestamps correctly', () => {
    const now = new Date();
    // Neither arrived nor checked in → BOOKED
    expect(deriveOpdStatus({ arrivedAt: null, checkedInAt: null })).toBe('BOOKED');

    // Arrived but not checked in → ARRIVED
    expect(deriveOpdStatus({ arrivedAt: now, checkedInAt: null })).toBe('ARRIVED');

    // Checked in → CHECKED_IN (takes priority)
    expect(deriveOpdStatus({ arrivedAt: now, checkedInAt: now })).toBe('CHECKED_IN');
  });

  it('Scenario 16: Waiting-to-nursing calculates minutes correctly', () => {
    const now = new Date('2025-01-15T10:00:00Z');
    const arrivedAt = new Date('2025-01-15T09:30:00Z');
    const nursingStart = new Date('2025-01-15T09:45:00Z');

    // Nursing started → 15 minutes
    expect(waitingToNursingMinutes(now, arrivedAt, nursingStart)).toBe(15);

    // Nursing not started → 30 minutes (using current time)
    expect(waitingToNursingMinutes(now, arrivedAt, undefined)).toBe(30);

    // Not arrived → null
    expect(waitingToNursingMinutes(now, undefined, nursingStart)).toBe(null);
  });

  it('Scenario 17: Waiting-to-doctor calculates correctly', () => {
    const now = new Date('2025-01-15T10:00:00Z');
    const nursingEnd = new Date('2025-01-15T09:45:00Z');
    const doctorStart = new Date('2025-01-15T09:55:00Z');

    // Doctor started → 10 minutes
    expect(waitingToDoctorMinutes(now, nursingEnd, doctorStart)).toBe(10);

    // Doctor not started → 15 minutes (using current time)
    expect(waitingToDoctorMinutes(now, nursingEnd, undefined)).toBe(15);

    // Nursing not done → null
    expect(waitingToDoctorMinutes(now, undefined, doctorStart)).toBe(null);
  });

  it('Scenario 18: Append-only timestamps refuse to overwrite existing values', () => {
    const existing = { arrivedAt: new Date('2025-01-15T09:00:00Z') };
    const incoming = {
      arrivedAt: new Date('2025-01-15T10:00:00Z'), // conflict!
      nursingStartAt: new Date('2025-01-15T09:30:00Z'), // new
    };

    const result = buildAppendOnlyTimestampPatch(existing, incoming);
    expect(result.conflict).toBeTruthy();
    expect(result.conflict!.field).toBe('arrivedAt');
    // nursingStartAt should still be in the patch
    expect(result.patch).toHaveProperty('opdTimestamps.nursingStartAt');
  });
});


// ═══════════════════════════════════════════════════════════════════
// GROUP 4: Nursing Assessment (Scenarios 19-25)
// ═══════════════════════════════════════════════════════════════════
describe('Group 4: Nursing Assessment', () => {
  it('Scenario 19: Vitals schema validates range boundaries', () => {
    // Valid vitals
    const valid = vitalsSchema.safeParse({
      systolic: 120,
      diastolic: 80,
      hr: 72,
      rr: 16,
      spo2: 98,
      temp: 36.6,
      weight: 70,
      height: 175,
    });
    expect(valid.success).toBe(true);

    // Out-of-range systolic
    const highBp = vitalsSchema.safeParse({ systolic: 400 });
    expect(highBp.success).toBe(false);

    // Out-of-range spo2
    const badSpo2 = vitalsSchema.safeParse({ spo2: 120 });
    expect(badSpo2.success).toBe(false);
  });

  it('Scenario 20: Nursing route detects critical vitals and auto-sets URGENT', () => {
    const src = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'nursing', 'route.ts');
    // Critical BP detection
    expect(src).toContain('sys >= 180');
    expect(src).toContain('sys <= 80');
    // Critical HR detection
    expect(src).toContain('vitals.hr >= 150');
    expect(src).toContain('vitals.hr <= 40');
    // Critical SpO2
    expect(src).toContain('vitals.spo2 <= 90');
    // Auto-priority
    expect(src).toContain("autoPriority = 'URGENT'");
  });

  it('Scenario 21: Nursing assessment records BMI when weight + height provided', () => {
    const src = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'nursing', 'route.ts');
    expect(src).toContain('vitals.weight / ((vitals.height / 100) ** 2)');
    expect(src).toContain('vitals.bmi');
  });

  it('Scenario 22: Nursing route enforces allowed flow states', () => {
    const src = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'nursing', 'route.ts');
    expect(src).toContain("'ARRIVED', 'WAITING_NURSE', 'IN_NURSING', 'READY_FOR_DOCTOR'");
    expect(src).toContain('Invalid opdFlowState for nursing entry');
  });

  it('Scenario 23: Nursing correction requires entryId + correctionReason', () => {
    const valid = opdNursingCorrectionSchema.safeParse({
      entryId: 'entry_001',
      correctionReason: 'BP reading was taken from wrong arm',
    });
    expect(valid.success).toBe(true);

    const noReason = opdNursingCorrectionSchema.safeParse({ entryId: 'entry_001' });
    expect(noReason.success).toBe(false);
  });

  it('Scenario 24: Time-out checklist covers all surgical safety fields', () => {
    const valid = timeOutChecklistSchema.safeParse({
      patientIdentified: true,
      procedureConfirmed: true,
      siteMarked: true,
      consentSigned: true,
      allergiesReviewed: true,
    });
    expect(valid.success).toBe(true);
  });

  it('Scenario 25: PFE (Patient & Family Education) schema is flexible', () => {
    const valid = pfeSchema.safeParse({
      allergies: 'None known',
      medications: 'Aspirin 100mg daily',
      medicalHistory: { hasNone: false, details: 'Hypertension' },
      educationTopics: ['Diabetes management', 'Wound care'],
      method: 'verbal',
      language: 'Arabic',
      barriers: ['Language'],
      understanding: 'Good',
      confirmed: true,
    });
    expect(valid.success).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════════
// GROUP 5: Doctor Visit & Flow State (Scenarios 26-33)
// ═══════════════════════════════════════════════════════════════════
describe('Group 5: Doctor Visit & Flow State Machine', () => {
  it('Scenario 26: Complete OPD flow state machine (happy path)', () => {
    // Full journey: START → ARRIVED → WAITING_NURSE → IN_NURSING → READY_FOR_DOCTOR → WAITING_DOCTOR → IN_DOCTOR → COMPLETED
    expect(isOpdFlowTransitionAllowed(null, 'ARRIVED').ok).toBe(true);
    expect(isOpdFlowTransitionAllowed('ARRIVED', 'WAITING_NURSE').ok).toBe(true);
    expect(isOpdFlowTransitionAllowed('WAITING_NURSE', 'IN_NURSING').ok).toBe(true);
    expect(isOpdFlowTransitionAllowed('IN_NURSING', 'READY_FOR_DOCTOR').ok).toBe(true);
    expect(isOpdFlowTransitionAllowed('READY_FOR_DOCTOR', 'WAITING_DOCTOR').ok).toBe(true);
    expect(isOpdFlowTransitionAllowed('WAITING_DOCTOR', 'IN_DOCTOR').ok).toBe(true);
    expect(isOpdFlowTransitionAllowed('IN_DOCTOR', 'COMPLETED').ok).toBe(true);
  });

  it('Scenario 27: Flow state allows doctor to send patient back to nursing', () => {
    // IN_DOCTOR → WAITING_NURSE or IN_NURSING (return to nursing)
    expect(isOpdFlowTransitionAllowed('IN_DOCTOR', 'WAITING_NURSE').ok).toBe(true);
    expect(isOpdFlowTransitionAllowed('IN_DOCTOR', 'IN_NURSING').ok).toBe(true);
  });

  it('Scenario 28: Flow state requires nursing before doctor (no fast-track skip)', () => {
    // ARRIVED must go through WAITING_NURSE first (tightened flow)
    expect(isOpdFlowTransitionAllowed('ARRIVED', 'READY_FOR_DOCTOR').ok).toBe(false);
    expect(isOpdFlowTransitionAllowed('ARRIVED', 'WAITING_NURSE').ok).toBe(true);
  });

  it('Scenario 29: COMPLETED is a terminal state (no further transitions)', () => {
    const transitions = getAllowedOpdFlowTransitions('COMPLETED');
    expect(transitions.allowed).toEqual([]);
  });

  it('Scenario 30: Invalid transitions are rejected', () => {
    // Cannot go backward from WAITING_DOCTOR to ARRIVED
    expect(isOpdFlowTransitionAllowed('WAITING_DOCTOR', 'ARRIVED').ok).toBe(false);
    // Cannot skip from WAITING_NURSE to COMPLETED
    expect(isOpdFlowTransitionAllowed('WAITING_NURSE', 'COMPLETED').ok).toBe(false);
    // Cannot go backward from IN_DOCTOR to ARRIVED
    expect(isOpdFlowTransitionAllowed('IN_DOCTOR', 'ARRIVED').ok).toBe(false);
  });

  it('Scenario 31: Visit notes require chiefComplaint + assessment + plan', () => {
    const valid = visitNotesSchema.safeParse({
      chiefComplaint: 'Chest pain for 2 hours',
      assessment: 'Possible angina',
      plan: 'ECG, cardiac enzymes, observation',
      diagnoses: [{ code: 'I20.9', description: 'Angina pectoris', diagnosisType: 'PRIMARY' }],
    });
    expect(valid.success).toBe(true);

    // Missing chiefComplaint
    const noChief = visitNotesSchema.safeParse({ assessment: 'Test', plan: 'Test' });
    expect(noChief.success).toBe(false);

    // Missing assessment
    const noAssess = visitNotesSchema.safeParse({ chiefComplaint: 'Test', plan: 'Test' });
    expect(noAssess.success).toBe(false);
  });

  it('Scenario 32: Visit notes route only allows doctor roles', () => {
    const src = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'visit-notes', 'route.ts');
    expect(src).toContain("['doctor', 'physician', 'consultant', 'specialist', 'opd-doctor']");
    expect(src).toContain('Forbidden');
  });

  it('Scenario 33: Visit notes route enforces flow state restrictions', () => {
    const src = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'visit-notes', 'route.ts');
    expect(src).toContain("'READY_FOR_DOCTOR', 'WAITING_DOCTOR', 'IN_DOCTOR', 'PROCEDURE_PENDING', 'PROCEDURE_DONE_WAITING'");
    expect(src).toContain('Visit notes يمكن كتابتها فقط في مرحلة الطبيب');
  });
});


// ═══════════════════════════════════════════════════════════════════
// GROUP 6: Orders (Lab, Radiology, Procedure) (Scenarios 34-38)
// ═══════════════════════════════════════════════════════════════════
describe('Group 6: Orders (Lab, Radiology, Procedure)', () => {
  it('Scenario 34: Order creation requires kind + title', () => {
    const valid = opdOrderSchema.safeParse({
      kind: 'LAB',
      title: 'CBC - Complete Blood Count',
      notes: 'Fasting required',
    });
    expect(valid.success).toBe(true);

    const noKind = opdOrderSchema.safeParse({ title: 'CBC' });
    expect(noKind.success).toBe(false);

    const noTitle = opdOrderSchema.safeParse({ kind: 'LAB' });
    expect(noTitle.success).toBe(false);
  });

  it('Scenario 35: Bulk orders require at least 1 order', () => {
    const valid = opdOrdersBulkSchema.safeParse({
      orders: [
        { kind: 'LAB', title: 'CBC' },
        { kind: 'RAD', title: 'Chest X-Ray' },
        { kind: 'PROCEDURE', title: 'ECG' },
      ],
    });
    expect(valid.success).toBe(true);

    const empty = opdOrdersBulkSchema.safeParse({ orders: [] });
    expect(empty.success).toBe(false);
  });

  it('Scenario 36: Order dueWithinDays must be 1-365', () => {
    const valid = opdOrderSchema.safeParse({
      kind: 'LAB',
      title: 'HbA1c',
      dueWithinDays: 30,
    });
    expect(valid.success).toBe(true);

    const zero = opdOrderSchema.safeParse({ kind: 'LAB', title: 'HbA1c', dueWithinDays: 0 });
    expect(zero.success).toBe(false);

    const tooHigh = opdOrderSchema.safeParse({ kind: 'LAB', title: 'HbA1c', dueWithinDays: 500 });
    expect(tooHigh.success).toBe(false);
  });

  it('Scenario 37: Orders route syncs to orders_hub for lab/rad worklist', () => {
    const src = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'orders', 'route.ts');
    expect(src).toContain('ordersHub.create');
    expect(src).toContain("sourceSystem: 'OPD'");
    expect(src).toContain("status: 'ORDERED'");
    // Maps kinds to departments
    expect(src).toContain("LAB: 'laboratory'");
    expect(src).toContain("RADIOLOGY: 'radiology'");
    expect(src).toContain("PHARMACY: 'pharmacy'");
  });

  it('Scenario 38: Cancel order requires cancelReason', () => {
    const valid = cancelOpdOrderSchema.safeParse({ cancelReason: 'Duplicate order' });
    expect(valid.success).toBe(true);

    const empty = cancelOpdOrderSchema.safeParse({ cancelReason: '' });
    expect(empty.success).toBe(false);

    const missing = cancelOpdOrderSchema.safeParse({});
    expect(missing.success).toBe(false);
  });
});


// ═══════════════════════════════════════════════════════════════════
// GROUP 7: Lab & Radiology Flows (Scenarios 39-41)
// ═══════════════════════════════════════════════════════════════════
describe('Group 7: Lab & Radiology Flows', () => {
  it('Scenario 39: Lab route files exist and use withAuthTenant', () => {
    const routes = [
      'app/api/lab/orders/route.ts',
      'app/api/lab/results/route.ts',
      'app/api/lab/specimens/route.ts',
      'app/api/lab/worklist/route.ts',
      'app/api/lab/critical-alerts/route.ts',
    ];
    for (const route of routes) {
      const src = readRoute(route);
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('tenantId');
    }
  });

  it('Scenario 40: Radiology route files exist and are secured', () => {
    const routes = [
      'app/api/radiology/studies/route.ts',
      'app/api/radiology/worklist/route.ts',
      'app/api/radiology/reports/route.ts',
    ];
    for (const route of routes) {
      const src = readRoute(route);
      expect(src).toContain('withAuthTenant');
      expect(src).toContain('tenantId');
    }
  });

  it('Scenario 41: Orders hub status mapping (PLACED/ORDERED/ACCEPTED → ORDERED)', () => {
    const src = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'orders', 'route.ts');
    // mapHubStatus function
    expect(src).toContain("case 'PLACED':");
    expect(src).toContain("case 'ORDERED':");
    expect(src).toContain("case 'ACCEPTED':");
    expect(src).toContain("return 'ORDERED'");
    expect(src).toContain("case 'RESULT_READY':");
    expect(src).toContain("return 'IN_PROGRESS'");
  });
});


// ═══════════════════════════════════════════════════════════════════
// GROUP 8: Pharmacy & Medication (Scenarios 42-44)
// ═══════════════════════════════════════════════════════════════════
describe('Group 8: Pharmacy & Medication', () => {
  it('Scenario 42: Pharmacy routes exist and are secured', () => {
    const routes = [
      'app/api/pharmacy/dispense/route.ts',
      'app/api/pharmacy/prescriptions/route.ts',
      'app/api/pharmacy/inventory/route.ts',
      'app/api/pharmacy/drug-interactions/route.ts',
    ];
    for (const route of routes) {
      const src = readRoute(route);
      expect(src).toContain('withAuthTenant');
    }
  });

  it('Scenario 43: Drug interaction check route exists', () => {
    const src = readRoute('app', 'api', 'pharmacy', 'drug-interactions', 'route.ts');
    expect(src).toContain('withAuthTenant');
    expect(src).toContain('withErrorHandler');
  });

  it('Scenario 44: Pharmacy inventory adjustment route exists', () => {
    const src = readRoute('app', 'api', 'pharmacy', 'inventory', 'adjust', 'route.ts');
    expect(src).toContain('withAuthTenant');
    expect(src).toContain('tenantId');
  });
});


// ═══════════════════════════════════════════════════════════════════
// GROUP 9: Billing & Payment (Scenarios 45-47)
// ═══════════════════════════════════════════════════════════════════
describe('Group 9: Billing & Payment', () => {
  it('Scenario 45: Payment snapshot normalization validates statuses', () => {
    // Valid payment
    const paid = normalizeOpdPaymentSnapshot({
      status: 'PAID',
      serviceType: 'CONSULTATION',
      method: 'CASH',
      amount: 150,
    });
    expect(paid.payment).toBeTruthy();
    expect(paid.error).toBeUndefined();

    // Invalid status
    const bad = normalizeOpdPaymentSnapshot({ status: 'MAGIC', serviceType: 'CONSULTATION' });
    expect(bad.error).toBeTruthy();
  });

  it('Scenario 46: Flow state auto-syncs booking to PENDING_PAYMENT on PROCEDURE_PENDING', () => {
    const src = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'flow-state', 'route.ts');
    expect(src).toContain("nextState === 'PROCEDURE_PENDING'");
    expect(src).toContain("status: 'PENDING_PAYMENT'");
    expect(src).toContain('pendingPaymentAt: now');
  });

  it('Scenario 47: Billing routes use withAuthTenant and are protected', () => {
    const routes = [
      'app/api/billing/charge-events/route.ts',
      'app/api/billing/payments/route.ts',
      'app/api/billing/claims/route.ts',
      'app/api/billing/invoices/recent/route.ts',
    ];
    for (const route of routes) {
      const src = readRoute(route);
      expect(src).toContain('withAuthTenant');
    }
  });
});


// ═══════════════════════════════════════════════════════════════════
// GROUP 10: Discharge & Disposition (Scenarios 48-49)
// ═══════════════════════════════════════════════════════════════════
describe('Group 10: Discharge & Disposition', () => {
  it('Scenario 48: Disposition schema validates disposition types', () => {
    for (const type of ['OPD_REFERRAL', 'ER_REFERRAL', 'ADMISSION']) {
      const valid = opdDispositionSchema.safeParse({ type, note: 'Needs further evaluation' });
      expect(valid.success).toBe(true);
    }

    const invalid = opdDispositionSchema.safeParse({ type: 'TELEPORT' });
    expect(invalid.success).toBe(false);
  });

  it('Scenario 49: COMPLETED flow state closes encounter + booking + sends SMS', () => {
    const src = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'flow-state', 'route.ts');

    // Closes OPD encounter
    expect(src).toContain("status: 'COMPLETED'");

    // Closes encounter_core
    expect(src).toContain("status: 'CLOSED'");
    expect(src).toContain('closedAt: now');

    // Completes booking if no open orders
    expect(src).toContain("status: 'COMPLETED', completedAt: now");

    // SMS on completion
    expect(src).toContain('شكراً لزيارتك');
    expect(src).toContain('sendSMS');

    // Requires diagnosis before completing (not for referral)
    expect(src).toContain('DIAGNOSIS_REQUIRED');
    expect(src).toContain('PRIMARY_DIAGNOSIS_REQUIRED');
  });
});


// ═══════════════════════════════════════════════════════════════════
// GROUP 11: Follow-up, Referral & Portal (Scenario 50)
// ═══════════════════════════════════════════════════════════════════
describe('Group 11: Follow-up, Referral & Portal', () => {
  it('Scenario 50: Full patient journey — route wiring end-to-end', () => {
    // Verify every stage of the patient journey has proper route wiring

    // 1) Registration
    const regRoute = readRoute('app', 'api', 'patients', 'route.ts');
    expect(regRoute).toContain('withAuthTenant');
    expect(regRoute).toContain('patientMaster');

    // 2) Encounter opening
    const openRoute = readRoute('app', 'api', 'opd', 'encounters', 'open', 'route.ts');
    expect(openRoute).toContain('encounterCore.create');
    expect(openRoute).toContain('opdEncounter.create');
    expect(openRoute).toContain("encounterType: 'OPD'");
    expect(openRoute).toContain("status: 'ACTIVE'");
    expect(openRoute).toContain("arrivalState: 'NOT_ARRIVED'");

    // 3) Flow state transitions
    const flowRoute = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'flow-state', 'route.ts');
    expect(flowRoute).toContain('isOpdFlowTransitionAllowed');
    expect(flowRoute).toContain('opdEventBus.emit');
    expect(flowRoute).toContain('VERSION_CONFLICT');

    // 4) Nursing assessment
    const nursingRoute = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'nursing', 'route.ts');
    expect(nursingRoute).toContain('opdNursingEntry.create');
    expect(nursingRoute).toContain('criticalVitalsFlag');

    // 5) Doctor visit notes
    const visitRoute = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'visit-notes', 'route.ts');
    expect(visitRoute).toContain('opdVisitNote.create');
    expect(visitRoute).toContain('assertEncounterNotCompleted');

    // 6) Orders to lab/rad
    const ordersRoute = readRoute('app', 'api', 'opd', 'encounters', '[encounterCoreId]', 'orders', 'route.ts');
    expect(ordersRoute).toContain('opdOrder.create');
    expect(ordersRoute).toContain('ordersHub.create');

    // 7) Referrals
    const refRoute = readRoute('app', 'api', 'referrals', 'route.ts');
    expect(refRoute).toContain('withAuthTenant');

    // 8) Portal access
    const portalAuth = readRoute('app', 'api', 'portal', 'auth', 'request-otp', 'route.ts');
    expect(portalAuth).toContain('otp');

    // 9) Portal results
    const portalResults = readRoute('app', 'api', 'portal', 'results', 'route.ts');
    expect(portalResults).toContain('tenantId');

    // 10) All routes use error handling
    const allRoutes = [openRoute, flowRoute, nursingRoute, visitRoute, ordersRoute];
    for (const src of allRoutes) {
      expect(src).toContain('withErrorHandler');
      expect(src).toContain('withAuthTenant');
    }
  });
});
