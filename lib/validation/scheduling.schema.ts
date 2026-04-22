import { z } from 'zod';

// ─── Resource Types ──────────────────────────────────────
export const schedulingResourceTypeEnum = z.enum([
  'CLINIC_ROOM', 'PROCEDURE_ROOM', 'RADIOLOGY_ROOM', 'LAB_STATION',
  'OR_ROOM', 'CATH_LAB', 'PHYSIO_ROOM', 'BED', 'EQUIPMENT',
  'STAFF_POOL', 'PROVIDER',
]);

// ─── Appointment Status ──────────────────────────────────
export const appointmentStatusEnum = z.enum([
  'SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS',
  'COMPLETED', 'CANCELLED', 'NO_SHOW',
]);

// ─── Reservation Types ───────────────────────────────────
export const reservationTypeEnum = z.enum(['HOLD', 'BOOKING']);

// ─── Subject Types ───────────────────────────────────────
export const subjectTypeEnum = z.enum([
  'ENCOUNTER_CORE', 'PATIENT_MASTER', 'EXTERNAL_REF',
]);

// ─── Update Appointment Status ───────────────────────────
export const updateAppointmentStatusSchema = z.object({
  status: appointmentStatusEnum,
});

// ─── Reschedule Appointment ──────────────────────────────
export const rescheduleAppointmentSchema = z.object({
  startAt: z.string().min(1, 'startAt is required'),
  endAt: z.string().min(1, 'endAt is required'),
});

// ─── Create Override ─────────────────────────────────────
export const createOverrideSchema = z.object({
  resourceId: z.string().min(1, 'resourceId is required'),
  date: z.string().min(1, 'date is required'),
  blocks: z.array(z.object({
    startTime: z.string(),
    endTime: z.string(),
    reason: z.string().optional(),
  })).optional(),
  opens: z.array(z.object({
    startTime: z.string(),
    endTime: z.string(),
    reason: z.string().optional(),
  })).optional(),
});

// ─── Create Reservation ──────────────────────────────────
export const createReservationSchema = z.object({
  slotId: z.string().min(1, 'slotId is required'),
  reservationType: reservationTypeEnum,
  subjectType: subjectTypeEnum,
  subjectId: z.string().min(1, 'subjectId is required'),
  notes: z.string().optional(),
  expiresAt: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

// ─── Cancel Reservation ──────────────────────────────────
export const cancelReservationSchema = z.object({
  reason: z.string().optional(),
});

// ─── Create Resource ─────────────────────────────────────
// departmentKey and displayName are optional for PROVIDER (API validates per resourceType)
export const createResourceSchema = z.object({
  resourceType: schedulingResourceTypeEnum,
  departmentKey: z.string().optional(),
  displayName: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.string().optional().default('ACTIVE'),
  consultationServiceCode: z.string().optional(),
  level: z.string().optional(),
  resourceRef: z.record(z.string(), z.unknown()).optional(),
  clientRequestId: z.string().optional(),
  providerId: z.string().optional(),
});

// ─── Update Resource Status ──────────────────────────────
export const updateResourceStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

// ─── Update Resource ─────────────────────────────────────
export const updateResourceSchema = z.object({
  departmentKey: z.string().optional(),
  displayName: z.string().optional(),
  tags: z.array(z.string()).optional(),
  resourceRef: z.record(z.string(), z.unknown()).optional(),
});

// ─── Create Template ─────────────────────────────────────
export const createTemplateSchema = z.object({
  clientRequestId: z.string().optional(),
  resourceId: z.string().min(1, 'resourceId is required'),
  timezone: z.string().optional(),
  rrule: z.string().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  startTime: z.string().min(1, 'startTime is required'),
  endTime: z.string().min(1, 'endTime is required'),
  slotMinutes: z.coerce.number().int().min(1, 'slotMinutes must be at least 1'),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional().default('ACTIVE'),
});

// ─── Update Template ─────────────────────────────────────
export const updateTemplateSchema = z.object({
  resourceId: z.string().optional(),
  timezone: z.string().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  slotMinutes: z.number().int().min(1).optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

// ─── Generate Slots ──────────────────────────────────────
export const generateSlotsSchema = z.object({
  resourceId: z.string().min(1, 'resourceId is required'),
  fromDate: z.string().min(1, 'fromDate is required'),
  toDate: z.string().min(1, 'toDate is required'),
});
