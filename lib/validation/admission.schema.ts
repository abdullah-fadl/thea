import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const admissionSourceEnum = z.enum(['OPD', 'ER', 'SCHEDULED_OR', 'EXTERNAL', 'DIRECT']);
export const admissionUrgencyEnum = z.enum(['ELECTIVE', 'URGENT', 'EMERGENCY']);
export const admissionBedTypeEnum = z.enum(['GENERAL', 'ICU', 'ISOLATION', 'VIP', 'NICU', 'PICU']);
export const admissionStatusEnum = z.enum([
  'PENDING', 'INSURANCE_REVIEW', 'VERIFIED', 'BED_ASSIGNED', 'ADMITTED', 'CANCELLED',
]);
export const transferStatusEnum = z.enum([
  'REQUESTED', 'APPROVED', 'BED_ASSIGNED', 'COMPLETED', 'CANCELLED', 'REJECTED',
]);
export const transferTypeEnum = z.enum(['REGULAR', 'ESCALATION', 'STEP_DOWN']);
export const transferUrgencyEnum = z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']);
export const targetUnitTypeEnum = z.enum(['ICU', 'CCU', 'WARD']);
export const reservationStatusEnum = z.enum(['ACTIVE', 'CONFIRMED', 'EXPIRED', 'CANCELLED']);
export const admissionPaymentTypeEnum = z.enum(['CASH', 'INSURANCE', 'GOVERNMENT']);
export const depositMethodEnum = z.enum(['CASH', 'CARD', 'BANK_TRANSFER']);

// ─── Admission Request ───────────────────────────────────────────────────────

export const createAdmissionRequestSchema = z.object({
  source: admissionSourceEnum,
  sourceEncounterId: z.string().min(1).optional().nullable(),
  sourceHandoffId: z.string().min(1).optional().nullable(),
  patientMasterId: z.string().min(1),
  requestingDoctorId: z.string().min(1),
  admittingDoctorId: z.string().min(1).optional().nullable(),
  targetDepartment: z.string().min(1),
  targetUnit: z.string().optional().nullable(),
  urgency: admissionUrgencyEnum.optional().default('ELECTIVE'),
  bedType: admissionBedTypeEnum.optional().default('GENERAL'),
  primaryDiagnosis: z.string().optional().nullable(),
  primaryDiagnosisCode: z.string().optional().nullable(),
  clinicalSummary: z.string().optional().nullable(),
  reasonForAdmission: z.string().optional().nullable(),
  isolationRequired: z.boolean().optional().default(false),
  isolationType: z.string().optional().nullable(),
  expectedLOS: z.number().int().positive().optional().nullable(),
  // ── Financial Fields ──
  paymentType: admissionPaymentTypeEnum.optional().nullable(),
  insuranceId: z.string().uuid().optional().nullable(),
}).passthrough();

export const updateAdmissionRequestSchema = z.object({
  status: admissionStatusEnum.optional(),
  admittingDoctorId: z.string().min(1).optional(),
  admittingDoctorName: z.string().optional(),
  targetDepartment: z.string().optional(),
  targetUnit: z.string().optional(),
  urgency: admissionUrgencyEnum.optional(),
  bedType: admissionBedTypeEnum.optional(),
  cancelReason: z.string().optional(),
}).passthrough();

// ─── Checklist ───────────────────────────────────────────────────────────────

export const updateChecklistItemSchema = z.object({
  itemKey: z.string().min(1),
  completed: z.boolean(),
  notes: z.string().optional(),
}).passthrough();

// ─── Bed Reservation ─────────────────────────────────────────────────────────

export const createBedReservationSchema = z.object({
  admissionRequestId: z.string().min(1),
  bedId: z.string().min(1),
}).passthrough();

// ─── Ward Transfer ───────────────────────────────────────────────────────────

export const createWardTransferSchema = z.object({
  episodeId: z.string().min(1),
  toWard: z.string().min(1),
  toUnit: z.string().optional().nullable(),
  toBedType: z.string().optional().nullable(),
  reason: z.string().min(1),
  clinicalJustification: z.string().optional().nullable(),
  // ── ICU/CCU Transfer Fields ──
  transferType: transferTypeEnum.optional().default('REGULAR'),
  urgency: transferUrgencyEnum.optional().default('ROUTINE'),
  targetUnitType: targetUnitTypeEnum.optional().nullable(),
  escalationCriteria: z.object({
    reasons: z.array(z.string()).optional(),
    clinicalFindings: z.string().optional(),
    deteriorationTimeline: z.string().optional(),
  }).optional().nullable(),
  acuityData: z.object({
    sofaScore: z.any().optional(),
    apacheScore: z.any().optional(),
    mewsScore: z.number().optional(),
    gcsScore: z.number().optional(),
    capturedAt: z.string().optional(),
  }).optional().nullable(),
  sbarData: z.any().optional().nullable(),
  orderTemplateId: z.string().optional().nullable(),
}).passthrough();

export const updateWardTransferSchema = z.object({
  action: z.enum(['approve', 'reject', 'assign_bed', 'complete', 'cancel']),
  toBedId: z.string().min(1).optional(),
  transferSummary: z.string().optional(),
  nursingHandoff: z.any().optional(),
  // ── ICU/CCU Transfer Fields ──
  rejectionReason: z.string().optional(),
  orderTemplateId: z.string().optional(),
  applyOrderTemplate: z.boolean().optional(),
}).passthrough();

// ─── Order Templates ─────────────────────────────────────────────────────────

export const createOrderTemplateSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  departmentKey: z.string().min(1),
  diagnosisCode: z.string().optional(),
  items: z.array(
    z.object({
      kind: z.string().min(1),
      orderCode: z.string().optional(),
      orderName: z.string().min(1),
      orderNameAr: z.string().optional(),
      priority: z.string().optional().default('ROUTINE'),
      defaults: z.any().optional(),
      isRequired: z.boolean().optional().default(false),
    })
  ),
  isDefault: z.boolean().optional().default(false),
}).passthrough();

export const applyOrdersSchema = z.object({
  templateId: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        kind: z.string().min(1),
        title: z.string().min(1),
        notes: z.string().optional(),
      })
    )
    .optional(),
}).passthrough();

// ─── Default Checklist Items ─────────────────────────────────────────────────

export interface ChecklistItem {
  key: string;
  labelEn: string;
  labelAr: string;
  required: boolean;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  notes?: string;
}

export const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  { key: 'insurance_verified', labelEn: 'Insurance Verification', labelAr: 'التحقق من التأمين', required: true, completed: false },
  { key: 'financial_approval', labelEn: 'Financial Approval', labelAr: 'الموافقة المالية', required: true, completed: false },
  { key: 'admission_consent', labelEn: 'Admission Consent Signed', labelAr: 'توقيع موافقة القبول', required: true, completed: false },
  { key: 'allergies_confirmed', labelEn: 'Allergies Confirmed', labelAr: 'تأكيد الحساسية', required: true, completed: false },
  { key: 'infection_screening', labelEn: 'Infection Screening', labelAr: 'فحص العدوى', required: false, completed: false },
  { key: 'isolation_assessment', labelEn: 'Isolation Assessment', labelAr: 'تقييم العزل', required: false, completed: false },
  { key: 'code_status_documented', labelEn: 'Code Status (DNR/Full Code)', labelAr: 'توثيق حالة الإنعاش', required: true, completed: false },
  { key: 'home_medications_reconciled', labelEn: 'Home Medications Reconciled', labelAr: 'مصالحة الأدوية المنزلية', required: true, completed: false },
  { key: 'belongings_inventory', labelEn: 'Belongings Inventory', labelAr: 'جرد المقتنيات الشخصية', required: false, completed: false },
  { key: 'vte_risk_assessed', labelEn: 'VTE Risk Assessed', labelAr: 'تقييم خطر الجلطات', required: true, completed: false },
];

// ─── Status Transition Validation ────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['INSURANCE_REVIEW', 'VERIFIED', 'CANCELLED'], // VERIFIED directly if emergency
  INSURANCE_REVIEW: ['VERIFIED', 'CANCELLED'],
  VERIFIED: ['BED_ASSIGNED', 'ADMITTED', 'CANCELLED'], // ADMITTED directly if emergency
  BED_ASSIGNED: ['ADMITTED', 'VERIFIED', 'CANCELLED'], // VERIFIED = release reservation
  ADMITTED: [], // Terminal
  CANCELLED: [], // Terminal
};

export function isValidTransition(
  from: string,
  to: string,
  urgency?: string
): { valid: boolean; reason?: string } {
  if (from === to) return { valid: false, reason: 'Cannot transition to the same status' };

  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return { valid: false, reason: `Unknown status: ${from}` };

  if (allowed.includes(to)) return { valid: true };

  // Emergency fast-track: allow skipping intermediate steps
  if (urgency === 'EMERGENCY') {
    const emergencyAllowed = ['VERIFIED', 'BED_ASSIGNED', 'ADMITTED', 'CANCELLED'];
    if (emergencyAllowed.includes(to) && from !== 'ADMITTED' && from !== 'CANCELLED') {
      return { valid: true };
    }
  }

  return {
    valid: false,
    reason: `Cannot transition from ${from} to ${to}. Allowed: ${allowed.join(', ')}`,
  };
}

// ─── Ward Transfer Status Transition Validation ─────────────────────────────

const TRANSFER_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ['APPROVED', 'BED_ASSIGNED', 'COMPLETED', 'CANCELLED', 'REJECTED'],
  APPROVED: ['BED_ASSIGNED', 'COMPLETED', 'CANCELLED'],
  BED_ASSIGNED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal
  CANCELLED: [], // Terminal
  REJECTED: [],  // Terminal
};

export function isValidTransferTransition(
  from: string,
  to: string,
  requiresApproval: boolean,
  urgency?: string,
): { valid: boolean; reason?: string } {
  if (from === to) return { valid: false, reason: 'Cannot transition to same status' };
  const allowed = TRANSFER_TRANSITIONS[from];
  if (!allowed) return { valid: false, reason: `Unknown transfer status: ${from}` };

  // If approval not required (admin/emergency), allow REQUESTED → BED_ASSIGNED or COMPLETED directly
  if (!requiresApproval && from === 'REQUESTED' && ['BED_ASSIGNED', 'COMPLETED'].includes(to)) {
    return { valid: true };
  }

  // Emergency fast-track: REQUESTED → COMPLETED directly
  if (urgency === 'EMERGENCY' && from === 'REQUESTED' && to === 'COMPLETED') {
    return { valid: true };
  }

  if (allowed.includes(to)) return { valid: true };
  return { valid: false, reason: `Cannot transition from ${from} to ${to}. Allowed: ${allowed.join(', ')}` };
}

// ─── Admission Financial Schemas ──────────────────────────────────────────────

export const setPaymentTypeSchema = z.object({
  paymentType: admissionPaymentTypeEnum,
  insuranceId: z.string().uuid().optional().nullable(),
}).passthrough();

export const admissionDepositSchema = z.object({
  method: depositMethodEnum,
  amount: z.number().positive().max(9999999),
  reference: z.string().optional(),
  currency: z.string().optional().default('SAR'),
}).passthrough();

export const admissionCostEstimateSchema = z.object({
  bedType: admissionBedTypeEnum,
  expectedLOS: z.number().int().positive(),
}).passthrough();

export const admissionPreauthSchema = z.object({
  services: z.array(z.object({
    code: z.string().min(1),
    display: z.string().min(1),
    quantity: z.number().min(1).optional().default(1),
    unitPrice: z.number().min(0).optional(),
  })).optional(),
  diagnosis: z.array(z.object({
    code: z.string().min(1),
    display: z.string().min(1),
  })).optional(),
}).passthrough();
