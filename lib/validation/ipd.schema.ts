import { z } from 'zod';
import { medicationRouteEnum } from './shared.schema';

// ─── Medication Order Types ──────────────────────────────
export const medOrderTypeEnum = z.enum(['STAT', 'PRN', 'SCHEDULED']);

// ─── Medication Frequency ────────────────────────────────
export const medFrequencyEnum = z.enum(['Q6H', 'Q8H', 'Q12H', 'Q24H']);

// ─── Medication Status ───────────────────────────────────
export const medOrderStatusEnum = z.enum([
  'ORDERED', 'ACTIVE', 'DISPENSED', 'DISCONTINUED',
]);

// ─── AVPU Scale ──────────────────────────────────────────
export const avpuEnum = z.enum(['A', 'V', 'P', 'U']);

// ─── Care Plan Status ────────────────────────────────────
export const carePlanStatusEnum = z.enum(['ACTIVE', 'RESOLVED']);

// ─── Nursing Note Type ───────────────────────────────────
export const ipdNursingNoteTypeEnum = z.enum(['SHIFT_NOTE']);

// ─── ICU Destinations ────────────────────────────────────
export const icuDestinationEnum = z.enum(['WARD', 'ICU', 'DISCHARGE']);

// ─── Bed Assign ──────────────────────────────────────────
export const ipdBedAssignSchema = z.object({
  bedId: z.string().min(1, 'bedId is required'),
});

// ─── Create Medication Order ─────────────────────────────
export const createMedOrderSchema = z.object({
  medicationCatalogId: z.string().optional(),
  medicationName: z.string().optional(),
  orderType: medOrderTypeEnum,
  doseValue: z.string().min(1, 'doseValue is required'),
  doseUnit: z.string().min(1, 'doseUnit is required'),
  route: medicationRouteEnum,
  frequency: medFrequencyEnum.optional(),
  durationDays: z.number().int().positive().optional(),
  startAt: z.string().optional(),
  orderingDoctorId: z.string().min(1, 'orderingDoctorId is required'),
  isNarcotic: z.boolean().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
});

// ─── Update Medication Order Status ──────────────────────
export const updateMedOrderStatusSchema = z.object({
  status: medOrderStatusEnum,
  reason: z.string().optional(),
});

// ─── IPD Vitals ──────────────────────────────────────────
export const ipdVitalsSchema = z.object({
  systolic: z.number(),
  diastolic: z.number(),
  hr: z.number(),
  rr: z.number(),
  temp: z.number(),
  spo2: z.number(),
  painScore: z.number().min(0).max(10),
  avpu: avpuEnum,
});

// ─── Nursing Progress ────────────────────────────────────
export const nursingProgressSchema = z.object({
  responseToCarePlan: z.string().min(1, 'responseToCarePlan is required'),
  vitalsSummary: z.string().optional(),
  issues: z.string().optional(),
  escalations: z.string().optional(),
});

// ─── Nursing Note ────────────────────────────────────────
export const ipdNursingNoteSchema = z.object({
  type: ipdNursingNoteTypeEnum,
  content: z.string().min(1, 'content is required'),
});

// ─── Care Plan ───────────────────────────────────────────
export const createCarePlanSchema = z.object({
  problem: z.string().min(1, 'problem is required'),
  goals: z.string().optional(),
  interventions: z.string().optional(),
  status: carePlanStatusEnum.optional().default('ACTIVE'),
});

// ─── Doctor Progress ─────────────────────────────────────
export const doctorProgressSchema = z.object({
  type: z.enum(['SHIFT_NOTE']).optional(),
  content: z.string().min(1, 'content is required'),
}).passthrough();

// ─── ICU Admit ───────────────────────────────────────────
export const icuAdmitSchema = z.object({
  source: z.string().optional(),
  note: z.string().optional(),
});

// ─── ICU Transfer ────────────────────────────────────────
export const icuTransferSchema = z.object({
  destination: icuDestinationEnum,
  note: z.string().optional(),
});

// ─── Narcotic Count ──────────────────────────────────────
export const narcoticCountSchema = z.object({
  count: z.number().int().min(0),
  countedBy: z.string().min(1),
  verifiedBy: z.string().min(1),
});

// ─── IPD Admission Intake ────────────────────────────────
export const admissionIntakeSchema = z.object({
  handoffId: z.string().min(1, 'handoffId is required'),
}).passthrough();
