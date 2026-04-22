import { z } from 'zod';
import { vitalsSchema } from './shared.schema';

// ─── ER Staff Roles ──────────────────────────────────────
export const erStaffRoleEnum = z.enum([
  'attending', 'resident', 'nurse', 'charge', 'triage', 'tech',
]);

// ─── ER Disposition Types ────────────────────────────────
export const erDispositionTypeEnum = z.enum([
  'DISCHARGE', 'ADMIT', 'TRANSFER',
]);

// ─── ER Disposition Status (legacy) ──────────────────────
export const erDispositionStatusEnum = z.enum([
  'DISCHARGED', 'ADMITTED', 'TRANSFERRED',
]);

// ─── Triage Save ─────────────────────────────────────────
export const triageSaveSchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  vitals: vitalsSchema.optional(),
  painScore: z.number().min(0).max(10).optional(),
  chiefComplaint: z.string().optional(),
  allergiesShort: z.string().optional(),
  chronicShort: z.string().optional(),
  previousSurgeries: z.string().optional(),
  historyNotes: z.string().optional(),
  onset: z.string().optional(),
});

// ─── Triage Finish ───────────────────────────────────────
export const triageFinishSchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  chiefComplaint: z.string().optional(),
  vitals: vitalsSchema.optional(),
  painScore: z.number().min(0).max(10).optional(),
  allergiesShort: z.string().optional(),
  chronicShort: z.string().optional(),
  previousSurgeries: z.string().optional(),
  historyNotes: z.string().optional(),
  onset: z.string().optional(),
});

// ─── Bed Assign ──────────────────────────────────────────
export const erBedAssignSchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  bedId: z.string().min(1, 'bedId is required'),
  action: z.enum(['ASSIGN', 'UNASSIGN']).optional().default('ASSIGN'),
});

// ─── Encounter Disposition (legacy) ──────────────────────
export const erEncounterDispositionLegacySchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  status: erDispositionStatusEnum,
});

// ─── Encounter Disposition (detailed) ────────────────────
export const erEncounterDispositionSchema = z.object({
  type: erDispositionTypeEnum,
  // Discharge fields
  finalDiagnosis: z.string().optional(),
  dischargeInstructions: z.string().optional(),
  dischargeMedications: z.array(z.record(z.string(), z.unknown())).optional(),
  followUpPlan: z.string().optional(),
  sickLeaveRequested: z.boolean().optional(),
  // Admit fields
  admitService: z.string().optional(),
  admitWardUnit: z.string().optional(),
  acceptingPhysician: z.string().optional(),
  reasonForAdmission: z.string().optional(),
  handoffSbar: z.string().optional(),
  bedRequestCreated: z.boolean().optional(),
  // Transfer fields
  transferType: z.string().optional(),
  destinationFacilityUnit: z.string().optional(),
  reason: z.string().optional(),
});

// ─── Encounter Status ────────────────────────────────────
export const erEncounterStatusSchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  status: z.string().min(1, 'status is required'),
});

// ─── Staff Assign ────────────────────────────────────────
export const erStaffAssignSchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  userId: z.string().min(1, 'userId is required'),
  role: erStaffRoleEnum,
});

// ─── Nursing Note ────────────────────────────────────────
export const erNursingNoteSchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  type: z.enum(['SHIFT', 'PROGRESS']),
  content: z.string().min(1, 'content is required'),
});

// ─── Encounter Note ──────────────────────────────────────
export const erEncounterNoteSchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  content: z.string().optional(),
});

// ─── Doctor Note ─────────────────────────────────────────
export const erDoctorNoteSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  noteContent: z.string().min(1, 'noteContent is required'),
  noteType: z.string().optional(),
});

// ─── Respiratory Screen ──────────────────────────────────
export const respiratoryScreenSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  screeningData: z.record(z.string(), z.unknown()),
});

// ─── Nursing Observation ─────────────────────────────────
export const erNursingObservationSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  observationData: z.record(z.string(), z.unknown()),
});

// ─── Nursing Escalation ──────────────────────────────────
export const erNursingEscalationSchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  escalationType: z.string().min(1, 'escalationType is required'),
  escalationReason: z.string().min(1, 'escalationReason is required'),
});

// ─── Resolve Escalation ──────────────────────────────────
export const resolveEscalationSchema = z.object({
  escalationId: z.string().min(1, 'escalationId is required'),
  resolutionNotes: z.string().optional(),
});

// ─── Transfer Request ────────────────────────────────────
export const erTransferRequestSchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  destinationDepartment: z.string().min(1, 'destinationDepartment is required'),
  reason: z.string().min(1, 'reason is required'),
});

// ─── Resolve Transfer Request ────────────────────────────
export const resolveTransferRequestSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  status: z.string().min(1, 'status is required'),
});
