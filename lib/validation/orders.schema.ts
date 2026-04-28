import { z } from 'zod';

// ─── Order Kinds ─────────────────────────────────────────
export const orderKindEnum = z.enum([
  'LAB', 'RADIOLOGY', 'PROCEDURE', 'MEDICATION',
]);

// ─── Order Priority ──────────────────────────────────────
export const orderPriorityEnum = z.enum(['ROUTINE', 'STAT']);

// ─── Order Set Scope ─────────────────────────────────────
export const orderSetScopeEnum = z.enum(['ER', 'OPD', 'IPD', 'GLOBAL']);

// ─── Create Order ────────────────────────────────────────
export const createOrderSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  kind: orderKindEnum,
  orderCode: z.string().min(1, 'orderCode is required'),
  orderName: z.string().min(1, 'orderName is required'),
  idempotencyKey: z.string().optional(),
  priority: orderPriorityEnum.optional().default('ROUTINE'),
  clinicalText: z.string().optional(),
  departmentKey: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// ─── Assign Order ────────────────────────────────────────
export const assignOrderSchema = z.object({
  assignedTo: z.object({
    userId: z.string().min(1),
    display: z.string().optional(),
  }),
});

// ─── Cancel Order ────────────────────────────────────────
export const cancelOrderSchema = z.object({
  cancelReason: z.string().min(1, 'cancelReason is required'),
});

// ─── Link Order Context ──────────────────────────────────
export const linkOrderContextSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  noteId: z.string().min(1, 'noteId is required'),
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  reason: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

// ─── Create Order Set ────────────────────────────────────
export const createOrderSetSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  scope: orderSetScopeEnum,
  departmentKeys: z.array(z.string()).optional(),
  roleScope: z.array(z.string()).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional().default('ACTIVE'),
});

// ─── Apply Order Set ─────────────────────────────────────
export const applyOrderSetSchema = z.object({
  encounterType: z.enum(['ER', 'OPD', 'IPD']),
  encounterId: z.string().min(1, 'encounterId is required'),
});

// ─── Execute Order Set ───────────────────────────────────
export const executeOrderSetSchema = z.object({
  orderSetId: z.string().min(1, 'orderSetId is required'),
  patientId: z.string().min(1, 'patientId is required'),
  encounterId: z.string().min(1, 'encounterId is required'),
  encounterType: z.string().optional(),
});

// ─── Create Order Set Item ───────────────────────────────
export const createOrderSetItemSchema = z.object({
  kind: z.enum(['LAB', 'RADIOLOGY', 'PROCEDURE', 'NON_MED']),
  orderCode: z.string().min(1, 'orderCode is required'),
  displayName: z.string().min(1, 'displayName is required'),
  defaults: z.object({
    departmentKey: z.string().optional(),
    priority: z.string().optional(),
    clinicalText: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  required: z.boolean().optional(),
  position: z.number().int().optional(),
});
