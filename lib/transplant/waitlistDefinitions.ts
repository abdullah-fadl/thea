/**
 * Transplant Waitlist Definitions
 *
 * Constants, scoring calculators, and blood compatibility matrices
 * for the transplant waitlist management module.
 */

// ─── Organ Types ───────────────────────────────────────────────────────────────

export const ORGAN_TYPES = {
  KIDNEY: { ar: 'كلية', en: 'Kidney', avgWaitDays: 1460, icon: 'circle-dot' },
  LIVER: { ar: 'كبد', en: 'Liver', avgWaitDays: 365, icon: 'wind' },
  HEART: { ar: 'قلب', en: 'Heart', avgWaitDays: 180, icon: 'heart' },
  LUNG: { ar: 'رئة', en: 'Lung', avgWaitDays: 365, icon: 'wind' },
  PANCREAS: { ar: 'بنكرياس', en: 'Pancreas', avgWaitDays: 730, icon: 'circle' },
  BONE_MARROW: { ar: 'نخاع عظمي', en: 'Bone Marrow', avgWaitDays: 120, icon: 'activity' },
  CORNEA: { ar: 'قرنية', en: 'Cornea', avgWaitDays: 90, icon: 'eye' },
} as const;

export type OrganType = keyof typeof ORGAN_TYPES;
export const ORGAN_TYPE_VALUES = Object.keys(ORGAN_TYPES) as OrganType[];

// ─── Blood Types ───────────────────────────────────────────────────────────────

export const BLOOD_TYPES = {
  'A+': { ar: 'A+', en: 'A+' },
  'A-': { ar: 'A-', en: 'A-' },
  'B+': { ar: 'B+', en: 'B+' },
  'B-': { ar: 'B-', en: 'B-' },
  'AB+': { ar: 'AB+', en: 'AB+' },
  'AB-': { ar: 'AB-', en: 'AB-' },
  'O+': { ar: 'O+', en: 'O+' },
  'O-': { ar: 'O-', en: 'O-' },
} as const;

export type BloodType = keyof typeof BLOOD_TYPES;
export const BLOOD_TYPE_VALUES = Object.keys(BLOOD_TYPES) as BloodType[];

/**
 * Blood type compatibility matrix for organ transplant.
 * Indicates which donor blood types are compatible with each recipient type.
 * Key = recipient, Value = array of compatible donor types.
 */
export const BLOOD_COMPATIBILITY: Record<BloodType, BloodType[]> = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

// ─── Urgency Statuses ──────────────────────────────────────────────────────────

export const URGENCY_STATUSES = {
  EMERGENT: { ar: 'طارئ', en: 'Emergent', color: 'red', weight: 100 },
  URGENT: { ar: 'عاجل', en: 'Urgent', color: 'orange', weight: 50 },
  ROUTINE: { ar: 'روتيني', en: 'Routine', color: 'gray', weight: 10 },
} as const;

export type UrgencyStatus = keyof typeof URGENCY_STATUSES;
export const URGENCY_STATUS_VALUES = Object.keys(URGENCY_STATUSES) as UrgencyStatus[];

// ─── Medical Statuses ──────────────────────────────────────────────────────────

export const MEDICAL_STATUSES = {
  ACTIVE: { ar: 'نشط', en: 'Active', color: 'green' },
  TEMPORARILY_INACTIVE: { ar: 'غير نشط مؤقتاً', en: 'Temporarily Inactive', color: 'yellow' },
  PERMANENTLY_INACTIVE: { ar: 'غير نشط دائماً', en: 'Permanently Inactive', color: 'gray' },
  TRANSPLANTED: { ar: 'تم الزراعة', en: 'Transplanted', color: 'blue' },
  DECEASED: { ar: 'متوفى', en: 'Deceased', color: 'slate' },
  REMOVED: { ar: 'تمت الإزالة', en: 'Removed', color: 'red' },
} as const;

export type MedicalStatus = keyof typeof MEDICAL_STATUSES;
export const MEDICAL_STATUS_VALUES = Object.keys(MEDICAL_STATUSES) as MedicalStatus[];

// ─── Dialysis Types (Kidney) ───────────────────────────────────────────────────

export const DIALYSIS_TYPES = {
  HD: { ar: 'غسيل دموي', en: 'Hemodialysis' },
  PD: { ar: 'غسيل بريتوني', en: 'Peritoneal Dialysis' },
  NONE: { ar: 'لا يوجد', en: 'None' },
} as const;

export type DialysisType = keyof typeof DIALYSIS_TYPES;
export const DIALYSIS_TYPE_VALUES = Object.keys(DIALYSIS_TYPES) as DialysisType[];

// ─── Child-Pugh Classification (Liver) ─────────────────────────────────────────

export const CHILD_PUGH_CLASSES = {
  A: { ar: 'الفئة أ (خفيف)', en: 'Class A (Mild)', scoreRange: '5-6', survivalRate: '100% (1yr)' },
  B: { ar: 'الفئة ب (متوسط)', en: 'Class B (Moderate)', scoreRange: '7-9', survivalRate: '80% (1yr)' },
  C: { ar: 'الفئة ج (شديد)', en: 'Class C (Severe)', scoreRange: '10-15', survivalRate: '45% (1yr)' },
} as const;

export type ChildPughClass = keyof typeof CHILD_PUGH_CLASSES;

// ─── HLA Loci ──────────────────────────────────────────────────────────────────

export const HLA_LOCI = {
  classI: {
    label: { ar: 'الصنف الأول', en: 'Class I' },
    loci: {
      A: { ar: 'الموقع A', en: 'Locus A', alleles: 2 },
      B: { ar: 'الموقع B', en: 'Locus B', alleles: 2 },
      C: { ar: 'الموقع C', en: 'Locus C', alleles: 2 },
    },
  },
  classII: {
    label: { ar: 'الصنف الثاني', en: 'Class II' },
    loci: {
      DR: { ar: 'الموقع DR', en: 'Locus DR', alleles: 2 },
      DQ: { ar: 'الموقع DQ', en: 'Locus DQ', alleles: 2 },
    },
  },
} as const;

export interface HLATyping {
  classI: { a1: string; a2: string; b1: string; b2: string; c1: string; c2: string };
  classII: { dr1: string; dr2: string; dq1: string; dq2: string };
}

export interface CrossmatchEntry {
  date: string;
  donorId: string;
  result: 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';
  notes?: string;
}

export interface StatusHistoryEntry {
  date: string;
  from: string;
  to: string;
  reason: string;
  by: string;
}

// ─── Scoring Calculators ───────────────────────────────────────────────────────

/**
 * Calculate MELD-Na Score (Model for End-stage Liver Disease with sodium).
 * Used for liver transplant prioritization.
 *
 * MELD = 10 * (0.957 * ln(creatinine) + 0.378 * ln(bilirubin) + 1.120 * ln(INR)) + 6.43
 * Clamped to [6, 40] range.
 *
 * @param bilirubin Total bilirubin in mg/dL (minimum 1.0 for calculation)
 * @param creatinine Serum creatinine in mg/dL (minimum 1.0, maximum 4.0 for calculation)
 * @param inr INR value (minimum 1.0 for calculation)
 * @param sodium Optional serum sodium in mEq/L for MELD-Na adjustment
 * @returns MELD or MELD-Na score
 */
export function calculateMeldScore(
  bilirubin: number,
  creatinine: number,
  inr: number,
  sodium?: number,
): number {
  // Apply minimum values as per UNOS guidelines
  const bil = Math.max(bilirubin, 1.0);
  const cr = Math.min(Math.max(creatinine, 1.0), 4.0);
  const inrVal = Math.max(inr, 1.0);

  const meld =
    10 *
      (0.957 * Math.log(cr) +
        0.378 * Math.log(bil) +
        1.120 * Math.log(inrVal)) +
    6.43;

  let score = Math.round(Math.min(Math.max(meld, 6), 40));

  // Apply MELD-Na adjustment if sodium provided
  if (sodium !== undefined && sodium !== null && score > 11) {
    const na = Math.min(Math.max(sodium, 125), 137);
    const meldNa = score - na - 0.025 * score * (140 - na) + 140;
    score = Math.round(Math.min(Math.max(meldNa, 6), 40));
  }

  return score;
}

/**
 * Calculate number of days since the patient was listed.
 */
export function calculateWaitingDays(listingDate: Date | string): number {
  const listing = typeof listingDate === 'string' ? new Date(listingDate) : listingDate;
  const now = new Date();
  const diffMs = now.getTime() - listing.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Calculate composite priority score for waitlist ranking.
 *
 * Factors:
 * - Urgency weight (EMERGENT=100, URGENT=50, ROUTINE=10)
 * - Wait time bonus (1 point per 30 days, max 50)
 * - MELD score (for liver, 0-40, normalized to 0-40)
 * - PRA sensitization bonus (high PRA = harder to match = higher priority)
 * - Previous transplant penalty (re-transplants ranked slightly lower)
 *
 * @returns Composite priority score (higher = more urgent)
 */
export function calculatePriorityScore(
  urgency: UrgencyStatus,
  waitingDays: number,
  meldScore?: number | null,
  pra?: number | null,
  previousTransplants?: number,
): number {
  // Base urgency weight
  const urgencyWeight = URGENCY_STATUSES[urgency]?.weight ?? 10;

  // Wait time bonus: 1 point per 30 days, capped at 50
  const waitBonus = Math.min(Math.floor(waitingDays / 30), 50);

  // MELD contribution (for liver, otherwise 0)
  const meldContribution = meldScore != null ? meldScore : 0;

  // PRA sensitization: high PRA patients harder to match, bonus up to 20
  const praBonus = pra != null ? Math.round((pra / 100) * 20) : 0;

  // Previous transplant adjustment: -5 per prior transplant
  const priorPenalty = (previousTransplants ?? 0) * 5;

  const score = urgencyWeight + waitBonus + meldContribution + praBonus - priorPenalty;

  return Math.max(0, Math.round(score * 100) / 100);
}

/**
 * Determine the valid transitions from a given medical status.
 */
export function getValidStatusTransitions(currentStatus: MedicalStatus): MedicalStatus[] {
  const transitions: Record<MedicalStatus, MedicalStatus[]> = {
    ACTIVE: ['TEMPORARILY_INACTIVE', 'PERMANENTLY_INACTIVE', 'TRANSPLANTED', 'DECEASED', 'REMOVED'],
    TEMPORARILY_INACTIVE: ['ACTIVE', 'PERMANENTLY_INACTIVE', 'DECEASED', 'REMOVED'],
    PERMANENTLY_INACTIVE: ['ACTIVE', 'DECEASED', 'REMOVED'],
    TRANSPLANTED: ['ACTIVE'], // re-listing
    DECEASED: [],
    REMOVED: ['ACTIVE'], // re-listing
  };
  return transitions[currentStatus] ?? [];
}

/**
 * Format waiting days into a human-readable string.
 */
export function formatWaitTime(
  days: number,
  language: 'ar' | 'en',
): string {
  if (days < 30) {
    return language === 'ar' ? `${days} يوم` : `${days} days`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return language === 'ar' ? `${months} شهر` : `${months} months`;
  }
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) {
    return language === 'ar' ? `${years} سنة` : `${years} years`;
  }
  return language === 'ar'
    ? `${years} سنة و ${remainingMonths} شهر`
    : `${years}y ${remainingMonths}m`;
}
