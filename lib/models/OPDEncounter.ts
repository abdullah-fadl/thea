export const OPD_VISIT_TYPES = ['FVC', 'FVH', 'FU', 'RV', 'REF'] as const;
export type OPDVisitType = (typeof OPD_VISIT_TYPES)[number];

export const OPD_FLOW_STATES = [
  'ARRIVED',
  'WAITING_NURSE',
  'IN_NURSING',
  'READY_FOR_DOCTOR',
  'WAITING_DOCTOR',
  'IN_DOCTOR',
  'PROCEDURE_PENDING',
  'PROCEDURE_DONE_WAITING',
  'COMPLETED',
] as const;
export type OPDFlowState = (typeof OPD_FLOW_STATES)[number];

// [R-04] Unified arrival source enum — same values as opdArrivalSourceEnum in opd.schema.ts
export const OPD_ARRIVAL_SOURCES = ['WALK_IN', 'APPOINTMENT', 'REFERRAL', 'TRANSFER', 'RECEPTION', 'PATIENT'] as const;
export type OPDArrivalSource = (typeof OPD_ARRIVAL_SOURCES)[number];

export const OPD_PAYMENT_STATUSES = ['PAID', 'SKIPPED', 'PENDING'] as const;
export type OPDPaymentStatus = (typeof OPD_PAYMENT_STATUSES)[number];

export const OPD_PAYMENT_SERVICE_TYPES = ['CONSULTATION', 'FOLLOW_UP'] as const;
export type OPDPaymentServiceType = (typeof OPD_PAYMENT_SERVICE_TYPES)[number];

export const OPD_PAYMENT_METHODS = ['CASH', 'CARD', 'ONLINE'] as const;
export type OPDPaymentMethod = (typeof OPD_PAYMENT_METHODS)[number];

export type OPDArrivalState = 'NOT_ARRIVED' | 'ARRIVED' | 'IN_ROOM' | 'LEFT';
export type OPDStatus = 'OPEN' | 'COMPLETED';

export interface OPDTimestamps {
  arrivedAt?: Date;
  nursingStartAt?: Date;
  nursingEndAt?: Date;
  doctorStartAt?: Date;
  doctorEndAt?: Date;
  procedureStartAt?: Date;
  procedureEndAt?: Date;
}

export type OPDClinicExtensions = Record<string, Record<string, unknown>>;

export interface OPDPaymentSnapshot {
  status: OPDPaymentStatus;
  serviceType: OPDPaymentServiceType;
  paidAt?: Date;
  amount?: number | null;
  method?: OPDPaymentMethod;
  invoiceId?: string;
  reference?: string;
}

export interface OPDNursingEntry {
  id: string;
  createdAt: Date;
  createdByUserId?: string | null;
  nursingNote?: string | null;
  chiefComplaintShort?: string | null;
  painScore?: number | null;
  fallRiskScore?: number | null;
  fallRiskLabel?: 'LOW' | 'MED' | 'HIGH' | null;
  vitals?: {
    bp?: string | null;
    hr?: number | null;
    temp?: number | null;
    rr?: number | null;
    spo2?: number | null;
    weight?: number | null;
    height?: number | null;
    bmi?: number | null;
  };
  pfe?: {
    allergies?: string | null;
    medications?: string | null;
    medicalHistory?: string | null;
  };
  timeOutChecklist?: {
    patientIdentified?: boolean;
    procedureConfirmed?: boolean;
    siteMarked?: boolean;
    consentSigned?: boolean;
    allergiesReviewed?: boolean;
    completedAt?: Date | null;
    completedByUserId?: string | null;
  };

  // Correction fields
  isCorrected?: boolean;
  correctedAt?: Date | null;
  correctedByUserId?: string | null;
  correctionReason?: string | null;
  correctedEntryId?: string | null;
}

export interface OPDDoctorEntry {
  id: string;
  noteType: 'SOAP' | 'FREE';
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  freeText?: string | null;
  createdAt: Date;
  createdByUserId?: string | null;
}

export interface OPDDoctorAddendum {
  id: string;
  noteType: 'SOAP' | 'FREE';
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  freeText?: string | null;
  reason: string;
  createdAt: Date;
  createdByUserId?: string | null;
}

export interface OPDDisposition {
  type: 'OPD_REFERRAL' | 'ER_REFERRAL' | 'ADMISSION';
  note?: string | null;
}

export interface OPDResultViewed {
  resultId: string;
  viewedAt: Date;
  viewedBy: string;
}

export interface OPDBillingMeta {
  visitType?: 'NEW' | 'RETURN' | 'FOLLOW_UP';
  visitTypeCode?: 'FVC' | 'RV' | 'FU';
  serviceCode?: string;
  serviceName?: string;
  specialtyCode?: string;
  providerId?: string;
  price?: number;
  isFree?: boolean;
  reason?: string;
}

export interface OPDEncounter {
  id: string;
  tenantId: string;
  encounterCoreId: string;
  patientId: string;
  status: OPDStatus;
  arrivalState: OPDArrivalState;
  arrivalSource?: OPDArrivalSource;
  visitType?: OPDVisitType;
  opdFlowState?: OPDFlowState;
  opdTimestamps?: OPDTimestamps;
  payment?: OPDPaymentSnapshot;
  opdNursingEntries?: OPDNursingEntry[];
  opdDoctorEntries?: OPDDoctorEntry[];
  opdDisposition?: OPDDisposition;
  opdResultsViewed?: OPDResultViewed[];
  opdClinicExtensions?: OPDClinicExtensions;
  billingMeta?: OPDBillingMeta;
  priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  opdDoctorAddenda?: OPDDoctorAddendum[];
  createdAt: Date;
  updatedAt: Date;
  createdByUserId?: string | null;
}
