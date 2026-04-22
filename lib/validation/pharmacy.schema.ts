import { z } from 'zod';

// ─── Dispense Medication ─────────────────────────────────
export const dispenseMedicationSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  quantityDispensed: z.number().int().positive('quantityDispensed must be positive'),
  dispenseTime: z.string().optional(),
});

// ─── Inventory ───────────────────────────────────────────
export const createInventorySchema = z.object({
  medicationCode: z.string().min(1, 'medicationCode is required'),
  quantity: z.number().int().min(0),
  expiryDate: z.string().optional(),
  supplier: z.string().optional(),
});

// ─── Inventory Adjust ────────────────────────────────────
export const adjustInventorySchema = z.object({
  medicationId: z.string().min(1, 'medicationId is required'),
  adjustmentQuantity: z.number().int(),
  reason: z.string().min(1, 'reason is required'),
});

// ─── Lab Result Save ─────────────────────────────────────
export const saveLabResultSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  resultData: z.record(z.string(), z.unknown()),
  performedBy: z.string().min(1, 'performedBy is required'),
  resultDateTime: z.string().optional(),
});

// ─── Specimen Collect ────────────────────────────────────
export const collectSpecimenSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  specimenType: z.string().min(1, 'specimenType is required'),
  collectionTime: z.string().optional(),
  collectedBy: z.string().min(1, 'collectedBy is required'),
});

// ─── Lab Critical Alert ──────────────────────────────────
export const labCriticalAlertSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  alertType: z.string().min(1, 'alertType is required'),
  severity: z.string().min(1, 'severity is required'),
});

// ─── Radiology Report Save ───────────────────────────────
export const saveRadiologyReportSchema = z.object({
  studyId: z.string().min(1, 'studyId is required'),
  reportText: z.string().min(1, 'reportText is required'),
  reportedBy: z.string().min(1, 'reportedBy is required'),
  reportDateTime: z.string().optional(),
});

// ─── Radiology Study ─────────────────────────────────────
export const createRadiologyStudySchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  studyType: z.string().min(1, 'studyType is required'),
  orderingProvider: z.string().optional(),
});
