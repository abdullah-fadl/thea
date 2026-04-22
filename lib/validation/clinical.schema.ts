import { z } from 'zod';

// ─── Consent ─────────────────────────────────────────────
export const createConsentSchema = z.object({
  consentType: z.string().min(1, 'consentType is required'),
  patientId: z.string().min(1, 'patientId is required'),
  encounterId: z.string().optional(),
  signatureData: z.string().optional(),
  signedBy: z.string().optional(),
  guardianName: z.string().optional(),
  guardianRelation: z.string().optional(),
  witnessName: z.string().optional(),
  notes: z.string().optional(),
  signedAt: z.string().optional(),
});

// ─── Clinical Note ───────────────────────────────────────
export const createClinicalNoteSchema = z.object({
  noteContent: z.string().min(1, 'noteContent is required'),
  patientId: z.string().min(1, 'patientId is required'),
  encounterId: z.string().optional(),
  noteType: z.string().optional(),
});

// ─── Clinical Infra Bed ──────────────────────────────────
export const clinicalInfraBedSchema = z.object({
  id: z.string().optional(),
  clientRequestId: z.string().optional(),
  label: z.string().min(1, 'label is required'),
  facilityId: z.string().optional(),
  unitId: z.string().optional(),
  floorId: z.string().optional(),
  roomId: z.string().optional(),
  bedType: z.string().optional(),
  status: z.string().optional(),
});

// ─── Provider Onboard ────────────────────────────────────
export const clinicalInfraProviderSchema = z.object({
  name: z.string().min(1, 'name is required'),
  specialty: z.string().optional(),
  license: z.string().optional(),
  assignments: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

// ─── Provider Assignment ─────────────────────────────────
export const providerAssignmentSchema = z.object({
  assignmentId: z.string().optional(),
  roleId: z.string().optional(),
  departmentIds: z.array(z.string()).optional(),
}).passthrough();

// ─── Specialty ───────────────────────────────────────────
export const createSpecialtySchema = z.object({
  name: z.string().min(1, 'name is required'),
  code: z.string().optional(),
  description: z.string().optional(),
});

// ─── Quality Incident ────────────────────────────────────
export const createIncidentSchema = z.object({
  incidentType: z.string().min(1, 'incidentType is required'),
  description: z.string().min(1, 'description is required'),
  severity: z.string().optional(),
  department: z.string().optional(),
  reportedBy: z.string().optional(),
});

// ─── Update Incident Status ──────────────────────────────
export const updateIncidentStatusSchema = z.object({
  status: z.string().min(1, 'status is required'),
});

// ─── Root Cause Analysis ─────────────────────────────────
export const rcaSchema = z.object({
  rootCauseAnalysis: z.string().min(1, 'rootCauseAnalysis is required'),
  findings: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
});

// ─── Referral ────────────────────────────────────────────
export const createReferralSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  referringDepartment: z.string().min(1, 'referringDepartment is required'),
  receivingDepartment: z.string().min(1, 'receivingDepartment is required'),
  reason: z.string().min(1, 'reason is required'),
  priority: z.string().optional(),
});

// ─── Accept/Reject Referral ──────────────────────────────
export const acceptReferralSchema = z.object({
  acceptanceNotes: z.string().optional(),
});

export const rejectReferralSchema = z.object({
  rejectionReason: z.string().min(1, 'rejectionReason is required'),
});

// ─── Discharge Finalize ──────────────────────────────────
export const dischargeSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  dischargeType: z.string().min(1, 'dischargeType is required'),
  dischargeNotes: z.string().optional(),
});

// ─── Handover Create ─────────────────────────────────────
export const createHandoverSchema = z.object({
  fromDepartmentId: z.string().min(1, 'fromDepartmentId is required'),
  toDepartmentId: z.string().min(1, 'toDepartmentId is required'),
  patientId: z.string().min(1, 'patientId is required'),
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
});

// ─── Handover Finalize ───────────────────────────────────
export const finalizeHandoverSchema = z.object({
  handoverId: z.string().min(1, 'handoverId is required'),
  completionNotes: z.string().optional(),
});

// ─── Death Declaration ───────────────────────────────────
export const declareDeathSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  deathDateTime: z.string().min(1, 'deathDateTime is required'),
  certifyingPhysician: z.string().min(1, 'certifyingPhysician is required'),
  primaryCause: z.string().min(1, 'primaryCause is required'),
  secondaryCauses: z.array(z.string()).optional(),
});
