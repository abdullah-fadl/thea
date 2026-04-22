import { z } from 'zod';
import {
  paymentMethodEnum,
  activeInactiveEnum,
  departmentDomainEnum,
  applicabilityEnum,
  medicationRouteEnum,
  idempotencyKey,
} from './shared.schema';

// ─── Charge Catalog Item Types ───────────────────────────
export const chargeItemTypeEnum = z.enum([
  'VISIT', 'LAB_TEST', 'IMAGING', 'PROCEDURE',
  'MEDICATION', 'BED', 'SUPPLY', 'SERVICE',
]);

// ─── Unit Types ──────────────────────────────────────────
export const unitTypeEnum = z.enum([
  'PER_VISIT', 'PER_TEST', 'PER_DAY', 'PER_PROCEDURE', 'PER_DOSE',
]);

// ─── Claim Rejection Codes ───────────────────────────────
export const claimRejectionCodeEnum = z.enum([
  'MISSING_INFO', 'CODING_ERROR', 'ELIGIBILITY', 'DUPLICATE', 'OTHER',
]);

// ─── Currency Codes ─────────────────────────────────────
export const currencyCodeEnum = z.enum(['SAR', 'USD', 'EUR', 'AED', 'KWD', 'BHD', 'QAR', 'OMR', 'EGP', 'JOD']);

// ─── Payment Status ─────────────────────────────────────
export const paymentStatusEnum = z.enum(['COMPLETED', 'PENDING', 'FAILED']);

// ─── Payer Mode ──────────────────────────────────────────
export const payerModeEnum = z.enum(['CASH', 'INSURANCE']);

// ─── Policy Rule Types ───────────────────────────────────
export const policyRuleTypeEnum = z.enum([
  'ELIGIBILITY_NOTE', 'PREAUTH_NOTE', 'COVERAGE_NOTE', 'BILLING_NOTE',
]);

// ─── Validate Promo Code ─────────────────────────────────
export const validatePromoCodeSchema = z.object({
  code: z.string().min(1, 'code is required'),
  subtotal: z.number().optional(),
});

// ─── Release Orders ──────────────────────────────────────
export const releaseOrdersSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1, 'At least one order ID is required'),
  invoiceId: z.string().optional(),
  paymentMethod: paymentMethodEnum.optional(),
  paymentReference: z.string().optional(),
  amount: z.number().min(0).max(9999999).optional(),
});

// ─── Charge Event ────────────────────────────────────────
export const createChargeEventSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  patientMasterId: z.string().optional(),
  departmentKey: z.string().min(1, 'departmentKey is required'),
  source: z.object({
    type: z.enum(['MANUAL', 'ORDER']),
    orderId: z.string().optional(),
    orderItemId: z.string().optional(),
  }),
  chargeCatalogId: z.string().min(1, 'chargeCatalogId is required'),
  quantity: z.number().int().min(1).max(9999, 'quantity exceeds maximum').optional().default(1),
  payerType: z.enum(['CASH', 'INSURANCE', 'PENDING']).optional(),
  reason: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

// ─── Void Charge Event ───────────────────────────────────
export const voidChargeEventSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
});

// ─── Void Payment ────────────────────────────────────────
export const voidPaymentSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
  idempotencyKey: idempotencyKey,
});

// ─── Record Payment ──────────────────────────────────────
export const recordPaymentSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  method: paymentMethodEnum,
  amount: z.number().positive('amount must be positive').max(9999999, 'amount exceeds maximum'),
  currency: currencyCodeEnum,
  reference: z.string().optional(),
  note: z.string().optional(),
  idempotencyKey: idempotencyKey,
});

// ─── Create Medication Catalog ───────────────────────────
export const createMedicationCatalogSchema = z.object({
  genericName: z.string().min(1, 'genericName is required'),
  form: z.string().min(1, 'form is required'),
  strength: z.string().min(1, 'strength is required'),
  routes: z.union([z.array(medicationRouteEnum), medicationRouteEnum]),
  chargeCatalogId: z.string().optional(),
  chargeCode: z.string().optional(),
  basePrice: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
    z.number().min(0).max(9999999).optional()
  ),
  allowedForCash: z.boolean().optional().default(true),
  allowedForInsurance: z.boolean().optional().default(true),
  applicability: z.union([z.array(applicabilityEnum), applicabilityEnum]).optional(),
  isControlled: z.boolean().optional(),
  controlledSchedule: z.string().optional(),
  controlledClass: z.string().optional(),
});

// ─── Update Medication Catalog ───────────────────────────
export const updateMedicationCatalogSchema = z.object({
  genericName: z.string().optional(),
  form: z.string().optional(),
  strength: z.string().optional(),
  routes: z.union([z.array(medicationRouteEnum), medicationRouteEnum]).optional(),
  chargeCatalogId: z.string().optional(),
  chargeCode: z.string().optional(),
  status: activeInactiveEnum.optional(),
  isControlled: z.boolean().optional(),
  controlledSchedule: z.string().optional(),
  controlledClass: z.string().optional(),
});

// ─── Bulk Medication Catalog ─────────────────────────────
export const bulkMedicationCatalogSchema = z.object({
  items: z.array(createMedicationCatalogSchema).optional(),
  csvText: z.string().optional(),
});

// ─── Create Plan ─────────────────────────────────────────
export const createPlanSchema = z.object({
  payerId: z.string().min(1, 'payerId is required'),
  name: z.string().min(1, 'name is required'),
  planCode: z.string().min(1, 'planCode is required'),
  status: z.string().optional().default('ACTIVE'),
});

// ─── Update Plan ─────────────────────────────────────────
export const updatePlanSchema = z.object({
  name: z.string().optional(),
  status: activeInactiveEnum.optional(),
});

// ─── Create Charge Catalog ───────────────────────────────
export const createChargeCatalogSchema = z.object({
  name: z.string().min(1, 'name is required'),
  itemType: chargeItemTypeEnum,
  departmentDomain: departmentDomainEnum.nullish(),
  unitType: unitTypeEnum,
  basePrice: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? 0 : Number(v)),
    z.number().min(0, 'basePrice must be >= 0').max(9999999, 'basePrice exceeds maximum')
  ),
  allowedForCash: z.boolean(),
  allowedForInsurance: z.boolean(),
  applicability: z.preprocess(
    (v) => (Array.isArray(v) && v.length > 0 ? v : ['ER']),
    z.array(applicabilityEnum).min(1, 'At least one applicability required')
  ),
  status: z.string().optional().default('ACTIVE'),
  flags: z.array(z.string()).optional(),
  labSpecimen: z.string().optional(),
  labMethod: z.string().optional(),
  labPrepNotes: z.string().optional(),
  radModality: z.string().optional(),
  radBodySite: z.string().optional(),
  radContrastRequired: z.boolean().optional(),
});

// ─── Update Charge Catalog ───────────────────────────────
export const updateChargeCatalogSchema = z.object({
  name: z.string().optional(),
  basePrice: z.number().min(0).max(9999999).optional(),
  status: activeInactiveEnum.optional(),
  allowedForCash: z.boolean().optional(),
  allowedForInsurance: z.boolean().optional(),
  departmentDomain: departmentDomainEnum.optional(),
  applicability: z.array(applicabilityEnum).optional(),
  flags: z.array(z.string()).optional(),
  labSpecimen: z.string().optional(),
  labMethod: z.string().optional(),
  labPrepNotes: z.string().optional(),
  radModality: z.string().optional(),
  radBodySite: z.string().optional(),
  radContrastRequired: z.boolean().optional(),
});

// ─── Bulk Charge Catalog ─────────────────────────────────
export const bulkChargeCatalogSchema = z.object({
  items: z.array(createChargeCatalogSchema).optional(),
  csvText: z.string().optional(),
});

// ─── Lock / Unlock ───────────────────────────────────────
export const billingLockSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  reason: z.string().optional(),
  idempotencyKey: idempotencyKey,
});

// ─── Posting ─────────────────────────────────────────────
export const postingSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  idempotencyKey: idempotencyKey,
  note: z.string().optional(),
});

// ─── Unpost ──────────────────────────────────────────────
export const unpostSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  idempotencyKey: idempotencyKey,
  note: z.string().optional(),
  override: z.boolean().optional(),
  reason: z.string().optional(),
});

// ─── Create Claim ────────────────────────────────────────
export const createClaimSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
});

// ─── Reject Claim ────────────────────────────────────────
export const rejectClaimSchema = z.object({
  reasonCode: claimRejectionCodeEnum,
  reasonText: z.string().min(1, 'reasonText is required'),
});

// ─── Remit Claim ─────────────────────────────────────────
export const remitClaimSchema = z.object({
  paidAmount: z.number().positive('paidAmount must be positive').max(9999999, 'paidAmount exceeds maximum'),
  remittanceRef: z.string().optional(),
  paidAt: z.string().optional(),
});

// ─── Create Payer ────────────────────────────────────────
export const createPayerSchema = z.object({
  name: z.string().min(1, 'name is required'),
  code: z.string().min(1, 'code is required'),
  status: z.string().optional().default('ACTIVE'),
});

// ─── Update Payer ────────────────────────────────────────
export const updatePayerSchema = z.object({
  name: z.string().optional(),
  status: activeInactiveEnum.optional(),
});

// ─── Payer Context Set ───────────────────────────────────
export const payerContextSetSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  mode: payerModeEnum,
  insuranceCompanyId: z.string().optional(),
  insuranceCompanyName: z.string().optional(),
  memberOrPolicyRef: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: idempotencyKey,
});

// ─── Create Policy Rule ─────────────────────────────────
export const createPolicyRuleSchema = z.object({
  payerId: z.string().min(1, 'payerId is required'),
  planId: z.string().optional(),
  ruleType: policyRuleTypeEnum,
  title: z.string().min(1, 'title is required'),
  notes: z.string().optional(),
  status: z.string().optional().default('ACTIVE'),
});

// ─── Update Policy Rule ─────────────────────────────────
export const updatePolicyRuleSchema = z.object({
  title: z.string().optional(),
  notes: z.string().optional(),
  ruleType: policyRuleTypeEnum.optional(),
  status: activeInactiveEnum.optional(),
});

// ─── Create Payment ──────────────────────────────────────
export const createPaymentSchema = z.object({
  invoiceId: z.string().optional(),
  amount: z.number().positive('amount must be positive').max(9999999, 'amount exceeds maximum'),
  method: paymentMethodEnum,
  reference: z.string().optional(),
  status: paymentStatusEnum.optional().default('COMPLETED'),
  encounterCoreId: z.string().min(1).optional(),
});

// ─── Credit Notes ───────────────────────────────────────
export const creditNoteTypeEnum = z.enum([
  'VOID_REFUND', 'ADJUSTMENT', 'PATIENT_REFUND', 'INSURANCE_ADJUSTMENT',
]);

export const createCreditNoteSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  chargeEventId: z.string().optional(),
  invoiceId: z.string().optional(),
  type: creditNoteTypeEnum,
  amount: z.number().positive('amount must be positive').max(9999999, 'amount exceeds maximum'),
  reason: z.string().min(1, 'reason is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const approveCreditNoteSchema = z.object({
  action: z.enum(['APPROVE', 'CANCEL']),
  cancelReason: z.string().optional(),
});

// ─── Invoice Draft ───────────────────────────────────────
export const invoiceItemSchema = z
  .object({
    chargeCatalogId: z.string().optional(),
    description: z.string().optional(),
    serviceName: z.string().optional(),
    serviceCode: z.string().optional(),
    quantity: z.number().int().min(1).default(1),
    unitPrice: z.number().min(0).max(9999999),
    amount: z.number().min(0).max(9999999).optional(),
    totalPrice: z.number().min(0).max(9999999).optional(),
  })
  .transform((d) => ({
    ...d,
    description: d.description || d.serviceName || d.serviceCode || 'Item',
    amount: d.amount ?? d.totalPrice ?? (d.unitPrice * d.quantity),
  }));

export const createInvoiceDraftSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  encounterId: z.string().optional(),
  visitId: z.string().optional(),
  items: z.array(invoiceItemSchema).optional(),
  subtotal: z.number().min(0).max(9999999).optional(),
  insuranceDiscount: z.number().min(0).max(9999999).optional(),
  insuranceAmount: z.number().min(0).max(9999999).optional(),
  insuranceApprovalNumber: z.string().optional(),
  promoCode: z.string().optional(),
  promoDiscount: z.number().min(0).max(9999999).optional(),
  total: z.number().min(0).max(9999999).optional(),
});

// ─── Order Invoice ───────────────────────────────────────
export const orderInvoiceSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  orderIds: z.array(z.string().min(1)).min(1, 'At least one order ID is required'),
  encounterCoreId: z.string().optional(),
  insuranceDiscount: z.number().optional(),
  promoCode: z.string().optional(),
  promoDiscount: z.number().optional(),
  insuranceApprovalNumber: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentReference: z.string().optional(),
});
