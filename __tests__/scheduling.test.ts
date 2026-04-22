import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  createTemplateSchema,
  updateTemplateSchema,
  generateSlotsSchema,
  createResourceSchema,
  createReservationSchema,
  cancelReservationSchema,
  createOverrideSchema,
  updateAppointmentStatusSchema,
  rescheduleAppointmentSchema,
  updateResourceStatusSchema,
  updateResourceSchema,
  schedulingResourceTypeEnum,
  appointmentStatusEnum,
  reservationTypeEnum,
  subjectTypeEnum,
} from '@/lib/validation/scheduling.schema';
import { canManageScheduling } from '@/lib/scheduling/access';

function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════
// 1. Templates (Tests 1-4)
// ═══════════════════════════════════════════════════════════════
describe('Scheduling > Templates', () => {
  it('1 — createTemplateSchema requires resourceId, startTime, endTime, slotMinutes', () => {
    // Missing all required fields
    const empty = createTemplateSchema.safeParse({});
    expect(empty.success).toBe(false);
    if (!empty.success) {
      const fieldNames = empty.error.issues.map((i) => i.path[0]);
      expect(fieldNames).toContain('resourceId');
      expect(fieldNames).toContain('startTime');
      expect(fieldNames).toContain('endTime');
      expect(fieldNames).toContain('slotMinutes');
    }

    // Valid payload passes
    const valid = createTemplateSchema.safeParse({
      resourceId: 'res-001',
      startTime: '08:00',
      endTime: '17:00',
      slotMinutes: 15,
    });
    expect(valid.success).toBe(true);
  });

  it('2 — updateTemplateSchema makes all fields optional', () => {
    // Empty object is valid for a PATCH update
    const empty = updateTemplateSchema.safeParse({});
    expect(empty.success).toBe(true);

    // Partial update with only startTime
    const partial = updateTemplateSchema.safeParse({ startTime: '09:00' });
    expect(partial.success).toBe(true);

    // slotMinutes must be >= 1 when provided
    const badSlot = updateTemplateSchema.safeParse({ slotMinutes: 0 });
    expect(badSlot.success).toBe(false);

    // Status restricted to ACTIVE or ARCHIVED
    const badStatus = updateTemplateSchema.safeParse({ status: 'DELETED' });
    expect(badStatus.success).toBe(false);

    const goodStatus = updateTemplateSchema.safeParse({ status: 'ARCHIVED' });
    expect(goodStatus.success).toBe(true);
  });

  it('3 — template route checks for duplicate before insert', () => {
    const src = readRoute('app', 'api', 'scheduling', 'templates', 'route.ts');
    // Route performs a findFirst to detect existing template with same key fields
    expect(src).toContain('findFirst');
    expect(src).toContain('noOp');
    // The duplicate check matches on resourceId + rrule + startTime + endTime + slotMinutes + effectiveFrom
    expect(src).toContain('resourceId, rrule');
    expect(src).toContain('startTime, endTime, slotMinutes, effectiveFrom');
  });

  it('4 — template route uses audit logging on CREATE', () => {
    const src = readRoute('app', 'api', 'scheduling', 'templates', 'route.ts');
    expect(src).toContain("import { createAuditLog }");
    expect(src).toContain("'scheduling_template'");
    expect(src).toContain("'CREATE'");
    // Audit log receives the created template as after payload
    expect(src).toContain('after: template');
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. Resources (Tests 5-8)
// ═══════════════════════════════════════════════════════════════
describe('Scheduling > Resources', () => {
  it('5 — createResourceSchema requires resourceType', () => {
    const empty = createResourceSchema.safeParse({});
    expect(empty.success).toBe(false);
    if (!empty.success) {
      const fieldNames = empty.error.issues.map((i) => i.path[0]);
      expect(fieldNames).toContain('resourceType');
    }

    const valid = createResourceSchema.safeParse({ resourceType: 'CLINIC_ROOM' });
    expect(valid.success).toBe(true);
  });

  it('6 — PROVIDER resources require providerId at the route level', () => {
    // Schema itself does NOT enforce providerId (it is optional)
    const schemaResult = createResourceSchema.safeParse({ resourceType: 'PROVIDER' });
    expect(schemaResult.success).toBe(true);

    // But the route handler enforces providerId for PROVIDER type
    const src = readRoute('app', 'api', 'scheduling', 'resources', 'route.ts');
    expect(src).toContain("providerId is required for PROVIDER resources");
    // Route also validates that the provider exists in clinical infra
    expect(src).toContain('Provider not found');
  });

  it('7 — resource route deduplicates by provider or unique constraint', () => {
    const src = readRoute('app', 'api', 'scheduling', 'resources', 'route.ts');
    // Provider resources: checks for existing by resourceRefProviderId
    expect(src).toContain('resourceRefProviderId');
    expect(src).toContain('existingProvider');
    // Non-provider resources: uses DB unique constraint upsert
    expect(src).toContain('tenantId_resourceType_departmentKey_displayName');
    expect(src).toContain('upsert');
    // Both paths return noOp when duplicate found
    expect(src).toContain('noOp: true');
  });

  it('8 — schedulingResourceTypeEnum validates 11 resource types', () => {
    const validTypes = [
      'CLINIC_ROOM', 'PROCEDURE_ROOM', 'RADIOLOGY_ROOM', 'LAB_STATION',
      'OR_ROOM', 'CATH_LAB', 'PHYSIO_ROOM', 'BED', 'EQUIPMENT',
      'STAFF_POOL', 'PROVIDER',
    ];
    for (const t of validTypes) {
      expect(schedulingResourceTypeEnum.safeParse(t).success).toBe(true);
    }
    expect(schedulingResourceTypeEnum.safeParse('UNKNOWN_TYPE').success).toBe(false);
    expect(schedulingResourceTypeEnum.safeParse('').success).toBe(false);

    // Confirm the route also mirrors the set
    const src = readRoute('app', 'api', 'scheduling', 'resources', 'route.ts');
    expect(src).toContain("'CLINIC_ROOM'");
    expect(src).toContain("'PROVIDER'");
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. Slots (Tests 9-12)
// ═══════════════════════════════════════════════════════════════
describe('Scheduling > Slots', () => {
  it('9 — generateSlotsSchema requires resourceId, fromDate, toDate', () => {
    const empty = generateSlotsSchema.safeParse({});
    expect(empty.success).toBe(false);
    if (!empty.success) {
      const fieldNames = empty.error.issues.map((i) => i.path[0]);
      expect(fieldNames).toContain('resourceId');
      expect(fieldNames).toContain('fromDate');
      expect(fieldNames).toContain('toDate');
    }

    const valid = generateSlotsSchema.safeParse({
      resourceId: 'res-001',
      fromDate: '2026-03-01',
      toDate: '2026-03-15',
    });
    expect(valid.success).toBe(true);
  });

  it('10 — [S-01] slot generation route caps range at 90 days', () => {
    const src = readRoute('app', 'api', 'scheduling', 'slots', 'generate', 'route.ts');
    // Guard comment and logic
    expect(src).toContain('[S-01]');
    expect(src).toContain('90');
    expect(src).toContain('RANGE_TOO_LARGE');
    // Error message references 90 days
    expect(src).toContain('Date range exceeds 90 days');
    // Also validates fromDate < toDate
    expect(src).toContain('fromDate must be before toDate');
  });

  it('11 — slot purge cascades bookings -> reservations -> slots', () => {
    const src = readRoute('app', 'api', 'scheduling', 'slots', 'purge', 'route.ts');
    // Purge ALL mode cancels bookings first
    expect(src).toContain('opdBooking');
    expect(src).toContain('cancelledBookings');
    // Then cancels reservations
    expect(src).toContain('schedulingReservation');
    expect(src).toContain('cancelledReservations');
    expect(src).toContain('deletedReservations');
    // Finally deletes slots
    expect(src).toContain('deletedSlots');
    // Protects against deleting slots with active encounters unless forced
    expect(src).toContain('ACTIVE_ENCOUNTER_EXISTS');
  });

  it('12 — slot generation handles overnight shifts (endTime < startTime)', () => {
    const src = readRoute('app', 'api', 'scheduling', 'slots', 'generate', 'route.ts');
    // Overnight shift detection: endMin <= startMin
    expect(src).toContain('overnight');
    expect(src).toContain('endMin <= startMin');
    // Adds 24*60 minutes to treat end as next day
    expect(src).toContain('24 * 60');
    // Uses addOneDay for slots that spill into the next calendar day
    expect(src).toContain('addOneDay');
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. Reservations (Tests 13-16)
// ═══════════════════════════════════════════════════════════════
describe('Scheduling > Reservations', () => {
  it('13 — createReservationSchema requires slotId, reservationType, subjectType, subjectId', () => {
    const empty = createReservationSchema.safeParse({});
    expect(empty.success).toBe(false);
    if (!empty.success) {
      const fieldNames = empty.error.issues.map((i) => i.path[0]);
      expect(fieldNames).toContain('slotId');
      expect(fieldNames).toContain('reservationType');
      expect(fieldNames).toContain('subjectType');
      expect(fieldNames).toContain('subjectId');
    }

    // reservationType and subjectType must be valid enum values
    const badEnum = createReservationSchema.safeParse({
      slotId: 's-1',
      reservationType: 'INVALID',
      subjectType: 'INVALID',
      subjectId: 'sub-1',
    });
    expect(badEnum.success).toBe(false);

    // Valid payload
    const valid = createReservationSchema.safeParse({
      slotId: 's-1',
      reservationType: 'BOOKING',
      subjectType: 'PATIENT_MASTER',
      subjectId: 'sub-1',
    });
    expect(valid.success).toBe(true);
  });

  it('14 — HOLD reservation requires expiresAt at route level', () => {
    // Schema allows expiresAt to be optional (validation is at route level)
    const schemaHold = createReservationSchema.safeParse({
      slotId: 's-1',
      reservationType: 'HOLD',
      subjectType: 'PATIENT_MASTER',
      subjectId: 'sub-1',
    });
    expect(schemaHold.success).toBe(true);

    // But route enforces it
    const src = readRoute('app', 'api', 'scheduling', 'reservations', 'create', 'route.ts');
    expect(src).toContain("expiresAt is required for HOLD");
    // Also validates that expiresAt is in the future
    expect(src).toContain("expiresAt must be in the future");
  });

  it('15 — [S-01] reservation route uses $transaction to prevent race conditions', () => {
    const src = readRoute('app', 'api', 'scheduling', 'reservations', 'create', 'route.ts');
    expect(src).toContain('[S-01]');
    expect(src).toContain('$transaction');
    // Re-checks slot status inside the transaction
    expect(src).toContain('Re-check slot status inside transaction');
    expect(src).toContain('freshSlot');
    // Updates slot status atomically within the transaction
    expect(src).toContain('tx.schedulingSlot.updateMany');
    expect(src).toContain("status: 'OPEN'");
    // HOLD gets HELD, BOOKING gets BOOKED
    expect(src).toContain("'HELD'");
    expect(src).toContain("'BOOKED'");
  });

  it('16 — expire-sweep sets EXPIRED status on overdue HOLD reservations', () => {
    const src = readRoute('app', 'api', 'scheduling', 'reservations', 'expire-sweep', 'route.ts');
    // Finds active holds past expiry
    expect(src).toContain("status: 'ACTIVE'");
    expect(src).toContain("reservationType: 'HOLD'");
    expect(src).toContain('expiresAt');
    // Sets status to EXPIRED
    expect(src).toContain("status: 'EXPIRED'");
    // Re-opens the slot back to OPEN
    expect(src).toContain("status: 'OPEN'");
    // Only re-opens if slot was HELD
    expect(src).toContain("slot.status === 'HELD'");
    // Returns count
    expect(src).toContain('expiredCount');
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. Appointments (Tests 17-20)
// ═══════════════════════════════════════════════════════════════
describe('Scheduling > Appointments', () => {
  it('17 — updateAppointmentStatusSchema validates exactly 7 statuses', () => {
    const validStatuses = [
      'SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS',
      'COMPLETED', 'CANCELLED', 'NO_SHOW',
    ];
    for (const s of validStatuses) {
      const result = updateAppointmentStatusSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    }
    // Exactly 7 statuses in the enum
    expect(appointmentStatusEnum.options).toHaveLength(7);

    // Invalid status rejected
    expect(updateAppointmentStatusSchema.safeParse({ status: 'PENDING' }).success).toBe(false);
    expect(updateAppointmentStatusSchema.safeParse({ status: '' }).success).toBe(false);
    expect(updateAppointmentStatusSchema.safeParse({}).success).toBe(false);
  });

  it('18 — [S-03] appointment status FSM enforces valid transitions', () => {
    const src = readRoute('app', 'api', 'scheduling', 'appointments', '[appointmentId]', 'status', 'route.ts');
    // FSM marker
    expect(src).toContain('[S-03]');
    expect(src).toContain('ALLOWED_TRANSITIONS');

    // Terminal states have empty arrays (no further transitions)
    expect(src).toContain("COMPLETED:    []");
    expect(src).toContain("CANCELLED:    []");
    expect(src).toContain("NO_SHOW:      []");

    // Valid forward transitions
    expect(src).toContain("SCHEDULED:    ['CONFIRMED', 'CANCELLED', 'NO_SHOW']");
    expect(src).toContain("CONFIRMED:    ['ARRIVED', 'CANCELLED', 'NO_SHOW']");
    expect(src).toContain("ARRIVED:      ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW']");
    expect(src).toContain("IN_PROGRESS:  ['COMPLETED', 'CANCELLED']");

    // Returns proper error codes
    expect(src).toContain('TERMINAL_STATE');
    expect(src).toContain('INVALID_TRANSITION');
    expect(src).toContain('UNKNOWN_STATE');
  });

  it('19 — [S-02] reschedule rate limit 5/day per appointment', () => {
    const src = readRoute('app', 'api', 'scheduling', 'appointments', '[appointmentId]', 'reschedule', 'route.ts');
    expect(src).toContain('[S-02]');
    // Counts recent reschedules in audit log
    expect(src).toContain('auditLog.count');
    expect(src).toContain("action: 'RESCHEDULE'");
    // 24 hour window
    expect(src).toContain('24 * 60 * 60 * 1000');
    // Limit of 5
    expect(src).toContain('recentReschedules >= 5');
    // Returns 429 with code
    expect(src).toContain('RESCHEDULE_LIMIT');
    expect(src).toContain('429');
    // Error message
    expect(src).toContain('Maximum 5 per day');

    // rescheduleAppointmentSchema requires startAt and endAt
    const valid = rescheduleAppointmentSchema.safeParse({ startAt: '2026-03-01T10:00:00Z', endAt: '2026-03-01T10:30:00Z' });
    expect(valid.success).toBe(true);
    const missing = rescheduleAppointmentSchema.safeParse({});
    expect(missing.success).toBe(false);
  });

  it('20 — appointment route enriches response with patient data', () => {
    const src = readRoute('app', 'api', 'scheduling', 'appointments', 'route.ts');
    // Fetches patient records to enrich
    expect(src).toContain('patientMaster');
    expect(src).toContain('patientMap');
    expect(src).toContain('patientName');
    expect(src).toContain('patientPhone');
    // Also enriches resource data
    expect(src).toContain('resourceMap');
    expect(src).toContain('resourceName');
    // Slot times are merged into the appointment object
    expect(src).toContain('slotStart');
    expect(src).toContain('slotEnd');
  });
});

// ═══════════════════════════════════════════════════════════════
// Bonus: canManageScheduling access control
// ═══════════════════════════════════════════════════════════════
describe('Scheduling > Access Control', () => {
  it('canManageScheduling grants access to thea-owner, admin, charge, and ops roles', () => {
    expect(canManageScheduling({ user: {}, tenantId: 't1', role: 'thea-owner' })).toBe(true);
    expect(canManageScheduling({ user: {}, tenantId: 't1', role: 'admin' })).toBe(true);
    expect(canManageScheduling({ user: {}, tenantId: 't1', role: 'charge-nurse' })).toBe(true);
    expect(canManageScheduling({ user: {}, tenantId: 't1', role: 'operations-lead' })).toBe(true);
    expect(canManageScheduling({ user: {}, tenantId: 't1', role: 'ops-manager' })).toBe(true);
    // Regular roles denied
    expect(canManageScheduling({ user: {}, tenantId: 't1', role: 'doctor' })).toBe(false);
    expect(canManageScheduling({ user: {}, tenantId: 't1', role: 'nurse' })).toBe(false);
    expect(canManageScheduling({ user: {}, tenantId: 't1', role: 'receptionist' })).toBe(false);
  });
});
