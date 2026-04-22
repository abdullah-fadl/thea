import { z } from 'zod';

// ─── Pagination ───────────────────────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(20),
});

// ─── Date Helpers ─────────────────────────────────────────
export const isoDateString = z.string().datetime({ offset: true }).or(z.string().datetime());
export const isoDateStringOptional = isoDateString.optional();

// ─── MongoDB ObjectId ─────────────────────────────────────
export const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

// ─── Common ID field ─────────────────────────────────────
export const requiredId = z.string().min(1, 'ID is required');

// ─── Idempotency Key ─────────────────────────────────────
export const idempotencyKey = z.string().min(1, 'Idempotency key is required');

// ─── Payment Snapshot ─────────────────────────────────────
export const paymentSnapshotSchema = z.object({
  status: z.string().optional(),
  serviceType: z.string().optional(),
  amount: z.number().optional(),
  method: z.string().optional(),
  paidAt: z.string().optional(),
  invoiceId: z.string().optional(),
  reference: z.string().optional(),
}).passthrough();

// ─── Billing Meta ─────────────────────────────────────────
export const billingMetaSchema = z.record(z.string(), z.unknown()).optional();

// ─── Payment Methods ─────────────────────────────────────
export const paymentMethodEnum = z.enum([
  'CASH', 'CARD', 'BANK_TRANSFER', 'INSURANCE_COPAY', 'ONLINE',
]);

// ─── Status Enums ─────────────────────────────────────────
export const activeInactiveEnum = z.enum(['ACTIVE', 'INACTIVE']);

// ─── Department Domains ──────────────────────────────────
export const departmentDomainEnum = z.enum([
  'ER', 'OPD', 'LAB', 'RAD', 'IPD', 'OR', 'ICU', 'OTHER',
]);

// ─── Applicability ───────────────────────────────────────
export const applicabilityEnum = z.enum(['ER', 'OPD', 'IPD', 'ICU', 'OR']);

// ─── Medication Routes ───────────────────────────────────
export const medicationRouteEnum = z.enum(['PO', 'IV', 'IM', 'SC', 'INH', 'LOCAL']);

// ─── Priority ────────────────────────────────────────────
export const priorityEnum = z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']);

// ─── Vitals ──────────────────────────────────────────────
/** Range-validated optional number for vitals. Accepts null or undefined. */
const numRange = (min: number, max: number) =>
  z.union([z.number().min(min).max(max), z.null()]).optional();
const numOptional = () => z.union([z.number(), z.null()]).optional();
export const vitalsSchema = z.object({
  bp: z.string().optional().nullable(),
  systolic: numRange(30, 350),         // mmHg
  diastolic: numRange(10, 250),        // mmHg
  hr: numRange(10, 400),               // bpm (covers neonates)
  rr: numRange(2, 100),                // breaths/min
  temp: numRange(25, 45),              // °C
  spo2: numRange(0, 100),              // percentage
  weight: numRange(0.1, 700),          // kg
  height: numRange(10, 300),           // cm
  glucose: numRange(0.5, 50),          // mmol/L (or mg/dL handled separately)
  headCircumference: numOptional(),    // flexible — pediatrics
  fetalHr: numRange(60, 250),          // bpm
  fundalHeight: numRange(1, 50),       // cm
  HR: numRange(10, 400),               // alias
  RR: numRange(2, 100),                // alias
  TEMP: numRange(25, 45),              // alias
  SPO2: numRange(0, 100),             // alias
  BP: z.string().optional().nullable(),
}).passthrough();

// ─── Gender ──────────────────────────────────────────────
export const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']);

// ─── Patient Identifiers ────────────────────────────────
export const patientIdentifiersSchema = z.object({
  nationalId: z.string().optional(),
  iqama: z.string().optional(),
  passport: z.string().optional(),
}).passthrough();
