import { z } from 'zod';
import { vitalsSchema, paymentSnapshotSchema, billingMetaSchema, priorityEnum } from './shared.schema';

// ─── Visit Types ─────────────────────────────────────────
export const opdVisitTypeEnum = z.enum(['FVC', 'FVH', 'FU', 'RV', 'REF']);

// ─── Flow States ─────────────────────────────────────────
export const opdFlowStateEnum = z.enum([
  'ARRIVED', 'WAITING_NURSE', 'IN_NURSING', 'READY_FOR_DOCTOR',
  'WAITING_DOCTOR', 'IN_DOCTOR', 'PROCEDURE_PENDING',
  'PROCEDURE_DONE_WAITING', 'COMPLETED',
]);

// ─── Arrival Sources ─────────────────────────────────────
export const opdArrivalSourceEnum = z.enum([
  'WALK_IN', 'APPOINTMENT', 'REFERRAL', 'TRANSFER',
]);

// ─── Open Encounter ──────────────────────────────────────
export const openEncounterSchema = z.object({
  patientMasterId: z.string().min(1, 'patientMasterId is required'),
  reason: z.string().optional(),
  visitType: opdVisitTypeEnum.optional(),
  resourceId: z.string().optional(),
  billingMeta: billingMetaSchema,
});

// ─── Booking Status ──────────────────────────────────────
export const bookingStatusEnum = z.enum([
  'ACTIVE', 'PENDING_PAYMENT', 'CHECKED_IN', 'ARRIVED',
  'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
]);

export const updateBookingStatusSchema = z.object({
  status: bookingStatusEnum,
  reason: z.string().optional(),
});

// ─── Booking Pending Payment ─────────────────────────────
export const bookingPendingPaymentSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
  isFirstVisit: z.boolean().optional(),
});

// ─── Cancel Order ────────────────────────────────────────
export const cancelOpdOrderSchema = z.object({
  cancelReason: z.string().min(1, 'Cancel reason is required'),
});

// ─── Walk-in Booking ─────────────────────────────────────
export const walkInBookingSchema = z.object({
  patientMasterId: z.string().min(1, 'patientMasterId is required'),
  encounterCoreId: z.string().optional(),
  clinicId: z.string().optional(),
  resourceId: z.string().optional(),
  specialtyCode: z.string().optional(),
  chiefComplaint: z.string().optional(),
  priority: priorityEnum.optional().default('NORMAL'),
  billingMeta: billingMetaSchema,
  payment: paymentSnapshotSchema.optional(),
});

// ─── Recommendation Action ───────────────────────────────
export const recommendationActionSchema = z.object({
  action: z.enum(['acknowledge', 'dismiss']),
  reason: z.string().optional(),
});

// ─── Results Viewed ──────────────────────────────────────
export const resultsViewedSchema = z.object({
  resultId: z.string().min(1, 'resultId is required'),
});

// ─── Clinic Extensions ───────────────────────────────────
export const clinicExtensionsSchema = z.object({
  opdClinicExtensions: z.record(z.string(), z.unknown()).optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
});

// ─── Timestamps ──────────────────────────────────────────
export const opdTimestampsSchema = z.object({
  opdTimestamps: z.object({
    arrivedAt: z.string().optional(),
    nursingStartAt: z.string().optional(),
    nursingEndAt: z.string().optional(),
    doctorStartAt: z.string().optional(),
    doctorEndAt: z.string().optional(),
    procedureStartAt: z.string().optional(),
    procedureEndAt: z.string().optional(),
  }).passthrough().optional(),
  timestamps: z.object({
    arrivedAt: z.string().optional(),
    nursingStartAt: z.string().optional(),
    nursingEndAt: z.string().optional(),
    doctorStartAt: z.string().optional(),
    doctorEndAt: z.string().optional(),
    procedureStartAt: z.string().optional(),
    procedureEndAt: z.string().optional(),
  }).passthrough().optional(),
});

// ─── Arrival Action ──────────────────────────────────────
export const arrivalActionSchema = z.object({
  action: z.enum(['ARRIVE', 'ROOM', 'LEAVE']),
  visitType: opdVisitTypeEnum.optional(),
  arrivalSource: opdArrivalSourceEnum.optional(),
  payment: paymentSnapshotSchema.optional(),
});

// ─── Disposition ─────────────────────────────────────────
export const opdDispositionSchema = z.object({
  type: z.enum(['OPD_REFERRAL', 'ER_REFERRAL', 'ADMISSION']),
  note: z.string().optional(),
});

// ─── Encounter Status ────────────────────────────────────
export const opdEncounterStatusSchema = z.object({
  status: z.enum(['COMPLETED']),
});

// ─── Flow State ──────────────────────────────────────────
export const opdFlowStateSchema = z.object({
  opdFlowState: opdFlowStateEnum,
  _version: z.number().optional(),
  returnReason: z.string().optional(),
  completionReason: z.enum(['REFERRAL', 'NORMAL']).optional(),
});

// ─── Nursing ─────────────────────────────────────────────
export const timeOutChecklistSchema = z.object({
  patientIdentified: z.boolean().optional(),
  procedureConfirmed: z.boolean().optional(),
  siteMarked: z.boolean().optional(),
  consentSigned: z.boolean().optional(),
  allergiesReviewed: z.boolean().optional(),
}).passthrough();

export const pfeSchema = z
  .object({
    allergies: z.union([z.string(), z.record(z.string(), z.any())]).optional().nullable(),
    medications: z.union([z.string(), z.record(z.string(), z.any())]).optional().nullable(),
    medicalHistory: z.union([z.string(), z.record(z.string(), z.any())]).optional().nullable(),
    educationTopics: z.array(z.any()).optional().nullable(),
    method: z.union([z.string(), z.null()]).optional().nullable(),
    language: z.union([z.string(), z.null()]).optional().nullable(),
    barriers: z.array(z.any()).optional().nullable(),
    understanding: z.union([z.string(), z.null()]).optional().nullable(),
    confirmed: z.boolean().optional().nullable(),
  })
  .passthrough();

export const opdNursingSchema = z
  .object({
    nursingNote: z.union([z.string(), z.null()]).optional(),
    chiefComplaintShort: z.union([z.string(), z.null()]).optional(),
    painScore: z.union([z.number().min(0).max(10), z.null(), z.undefined()]).optional(),
    painLocation: z.union([z.string(), z.null()]).optional(),
    fallRiskScore: z.union([z.string(), z.number(), z.null()]).optional(),
    fallRiskLabel: z.union([z.string(), z.null()]).optional(),
    _version: z.union([z.number(), z.null()]).optional(),
    priority: z.union([priorityEnum, z.null(), z.undefined()]).optional(),
    vitals: z.any().optional(),
    timeOutChecklist: z.any().optional(),
    pfe: z.any().optional(),
  })
  .passthrough();

export const opdNursingCorrectionSchema = z.object({
  entryId: z.string().min(1, 'entryId is required'),
  correctionReason: z.string().min(1, 'correctionReason is required'),
});

// ─── Orders ──────────────────────────────────────────────
export const opdOrderSchema = z.object({
  kind: z.enum(['LAB', 'RAD', 'PROCEDURE']),
  title: z.string().min(1, 'title is required'),
  catalogItemId: z.string().optional(),
  catalogCode: z.string().optional(),
  price: z.number().optional(),
  notes: z.string().optional(),
  dueWithinDays: z.number().int().min(1).max(365).optional(),
});

export const opdOrdersBulkSchema = z.object({
  orders: z.array(opdOrderSchema).min(1, 'At least one order is required'),
});

// ─── Visit Notes ─────────────────────────────────────────
export const visitNotesSchema = z.object({
  chiefComplaint: z.string().min(1, 'chiefComplaint is required'),
  historyOfPresentIllness: z.string().optional(),
  physicalExam: z.string().optional(),
  assessment: z.string().min(1, 'assessment is required'),
  plan: z.string().min(1, 'plan is required'),
  diagnoses: z.array(z.record(z.string(), z.unknown())).optional(),
  vitalsSnapshot: z.record(z.string(), z.unknown()).optional(),
});

// ─── Physical Exam ───────────────────────────────────────
export const physicalExamSchema = z.object({
  systems: z.record(z.string(), z.unknown()).optional(),
  summary: z.string().optional(),
});

// ─── Create Booking ──────────────────────────────────────
export const createBookingSchema = z.object({
  resourceId: z.string().min(1, 'resourceId is required'),
  clinicId: z.string().min(1, 'clinicId is required'),
  bookingType: z.enum(['PATIENT', 'BLOCK']),
  slotIds: z.array(z.string().min(1)).min(1, 'At least one slot is required'),
  patientMasterId: z.string().optional(),
  reason: z.string().optional(),
  clientRequestId: z.string().optional(),
  visitType: opdVisitTypeEnum.optional(),
  billingMeta: billingMetaSchema,
});

// ─── Cancel Booking ──────────────────────────────────────
export const cancelBookingSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
  reason: z.string().min(1, 'reason is required'),
});

// ─── Check-in Booking ────────────────────────────────────
export const checkInBookingSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
  payment: paymentSnapshotSchema.optional(),
  billingMeta: billingMetaSchema,
});
