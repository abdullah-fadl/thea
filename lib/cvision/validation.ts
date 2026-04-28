/**
 * CVision (HR OS) - Zod Validation Schemas
 * 
 * All API request validation schemas.
 */

import { z } from 'zod';
import {
  EMPLOYEE_STATUSES,
  REQUEST_TYPES,
  REQUEST_STATUSES,
  REQUEST_PRIORITIES,
  REQUEST_CONFIDENTIALITY_LEVELS,
  REQUEST_OWNER_ROLES,
  REQUEST_EVENT_TYPES,
  REQUISITION_STATUSES,
  REQUISITION_REASONS,
  EMPLOYMENT_TYPES,
  CANDIDATE_STATUSES,
  CANDIDATE_SOURCES,
  CANDIDATE_DOCUMENT_KINDS,
} from './constants';

// =============================================================================
// Common Schemas
// =============================================================================

// Helper to convert null to undefined before coercion
const nullToUndefined = <T>(val: T | null): T | undefined => 
  val === null ? undefined : val;

export const paginationSchema = z.object({
  page: z.preprocess(nullToUndefined, z.coerce.number().int().min(1).default(1)),
  limit: z.preprocess(nullToUndefined, z.coerce.number().int().min(1).max(1000).default(20)), // Increased max to 1000 for dashboard stats
  search: z.preprocess(nullToUndefined, z.string().optional()),
  sortBy: z.preprocess(nullToUndefined, z.string().optional()),
  sortOrder: z.preprocess(nullToUndefined, z.enum(['asc', 'desc']).optional()),
  includeDeleted: z.preprocess(nullToUndefined, z.coerce.boolean().optional()),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

// =============================================================================
// Department Schemas
// =============================================================================

export const createDepartmentSchema = z.object({
  code: z.string().min(1).max(50).trim(),
  name: z.string().min(1).max(200).trim(),
  nameAr: z.string().max(200).trim().optional(),
  description: z.string().max(1000).trim().optional(),
  parentId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

// =============================================================================
// Unit Schemas
// =============================================================================

export const createUnitSchema = z.object({
  code: z.string().min(1).max(50).trim(),
  name: z.string().min(1).max(200).trim(),
  nameAr: z.string().max(200).trim().optional(),
  description: z.string().max(1000).trim().optional(),
  departmentId: z.string().min(1),
  managerId: z.string().nullable().optional(),
  headNurseId: z.string().nullable().optional(),
  nursingManagerId: z.string().nullable().optional(),
  minStaffDay: z.number().int().min(0).optional(),
  minStaffNight: z.number().int().min(0).optional(),
  minStaffEvening: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateUnitSchema = createUnitSchema.partial();

// =============================================================================
// Job Title Schemas
// =============================================================================

export const createJobTitleSchema = z.object({
  code: z.string().min(1).max(50).trim(),
  name: z.string().min(1).max(200).trim(),
  nameAr: z.string().max(200).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  departmentId: z.string().uuid('departmentId must be a valid UUID').min(1, 'departmentId is required'), // Required field
  unitId: z.string().uuid().nullable().optional(), // Optional FK to CVisionUnit
  gradeId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  requirements: z.array(z.string().max(500)).max(20).optional(),
  responsibilities: z.array(z.string().max(500)).max(20).optional(),
});

export const updateJobTitleSchema = createJobTitleSchema.partial();

// =============================================================================
// Grade Schemas
// =============================================================================

const gradeBaseSchema = z.object({
  code: z.string().min(1).max(50).trim(),
  name: z.string().min(1).max(200).trim(),
  nameAr: z.string().max(200).trim().optional(),
  description: z.string().max(1000).trim().optional(),
  level: z.number().int().min(1).max(100),
  minSalary: z.number().min(0).optional(),
  maxSalary: z.number().min(0).optional(),
  currency: z.string().length(3).optional(), // ISO 4217
  isActive: z.boolean().default(true),
  jobTitleId: z.string().uuid().nullable().optional(), // Legacy - single job title (deprecated)
  jobTitleIds: z.array(z.string().uuid()).optional(), // New - supports multiple job titles
});

const salaryRangeRefinement = (data: { minSalary?: number; maxSalary?: number }) =>
  !data.minSalary || !data.maxSalary || data.minSalary <= data.maxSalary;

export const createGradeSchema = gradeBaseSchema.refine(
  salaryRangeRefinement,
  { message: 'minSalary must be less than or equal to maxSalary' }
);

// =============================================================================
// Budgeted Position Schemas (PR-D: Budget v1)
// =============================================================================

export const createBudgetedPositionSchema = z.object({
  departmentId: z.string().uuid('Department ID must be a valid UUID'),
  unitId: z.string().uuid().nullable().optional(), // Optional FK to CVisionUnit
  jobTitleId: z.string().uuid('Job Title ID must be a valid UUID'),
  gradeId: z.string().uuid().nullable().optional(), // Optional FK to CVisionGrade
  positionCode: z.string().min(1).max(50).trim().optional(), // Auto-generated if not provided
  title: z.string().max(200).trim().optional().nullable(),
  budgetedHeadcount: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateBudgetedPositionSchema = z.object({
  title: z.string().max(200).trim().optional().nullable(),
  budgetedHeadcount: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateGradeSchema = gradeBaseSchema.partial().refine(
  salaryRangeRefinement,
  { message: 'minSalary must be less than or equal to maxSalary' }
);

// =============================================================================
// Employee Schemas
// =============================================================================

export const addressSchema = z.object({
  street: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
});

export const emergencyContactSchema = z.object({
  name: z.string().max(200).optional(),
  relationship: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
});

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  firstNameAr: z.string().max(100).trim().optional(),
  lastNameAr: z.string().max(100).trim().optional(),
  email: z.string().email().max(200).toLowerCase().trim(),
  phone: z.string().max(50).trim().optional(),
  
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  nationality: z.string().max(100).optional(),
  nationalId: z.string().max(50).optional(),
  passportNumber: z.string().max(50).optional(),
  
  departmentId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  jobTitleId: z.string().uuid().nullable().optional(),
  positionId: z.string().uuid().nullable().optional(),
  gradeId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  hireDate: z.coerce.date(),
  probationEndDate: z.coerce.date().optional(),
  contractEndDate: z.coerce.date().optional(),
  
  status: z.string()
    .transform((val) => {
      const upper = String(val).toUpperCase();
      return upper || 'PROBATION';
    })
    .default('PROBATION'),
  
  address: addressSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ status: true });

export const changeEmployeeStatusSchema = z.object({
  status: z.enum(EMPLOYEE_STATUSES),
  reason: z.string().max(1000).optional(),
  effectiveDate: z.coerce.date().default(() => new Date()),
  notes: z.string().max(2000).optional(),
});

// =============================================================================
// Request Schemas
// =============================================================================

export const createRequestSchema = z.object({
  type: z.enum(REQUEST_TYPES),
  title: z.string().min(1).max(500).trim(),
  description: z.string().min(1).max(5000).trim(),
  priority: z.enum(REQUEST_PRIORITIES).default('medium'),
  confidentiality: z.enum(REQUEST_CONFIDENTIALITY_LEVELS).default('normal'),
  targetManagerEmployeeId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateRequestSchema = z.object({
  title: z.string().min(1).max(500).trim().optional(),
  description: z.string().min(1).max(5000).trim().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const commentRequestSchema = z.object({
  content: z.string().min(1).max(5000).trim(),
  isInternal: z.boolean().default(false),
});

export const escalateRequestSchema = z.object({
  reason: z.string().min(1).max(2000).trim(),
  forceEscalation: z.boolean().default(false), // Admin override
});

export const assignRequestSchema = z.object({
  assignToUserId: z.string().uuid(),
  assignToRole: z.enum(REQUEST_OWNER_ROLES),
  notes: z.string().max(2000).optional(),
});

export const closeRequestSchema = z.object({
  resolution: z.string().min(1).max(5000).trim(),
  status: z.enum(['approved', 'rejected', 'closed']).default('closed'),
});

// Legacy compatibility
export const submitRequestSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const reviewRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().max(2000).optional(),
  resolution: z.string().max(5000).optional(),
});

export const addRequestNoteSchema = z.object({
  content: z.string().min(1).max(5000).trim(),
  isInternal: z.boolean().default(false),
});

// =============================================================================
// Job Requisition Schemas
// =============================================================================

export const salaryRangeSchema = z.object({
  min: z.number().min(0).optional(),
  max: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
}).refine(
  (data) => !data.min || !data.max || data.min <= data.max,
  { message: 'min must be less than or equal to max' }
);

export const experienceRangeSchema = z.object({
  min: z.number().int().min(0).optional(),
  max: z.number().int().min(0).optional(),
}).refine(
  (data) => !data.min || !data.max || data.min <= data.max,
  { message: 'min must be less than or equal to max' }
);

// Base schema for job requisitions (used for partial updates)
const jobRequisitionBaseSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  description: z.string().max(10000).trim().optional(),

  departmentId: z.string().uuid(), // Required for Draft
  unitId: z.string().uuid().nullable().optional(),
  jobTitleId: z.string().uuid(), // Required for Draft (PR-B)
  gradeId: z.string().uuid().nullable().optional(),
  positionId: z.string().uuid(), // Required for Draft (PR-B)
  headcount: z.number().int().min(1).max(100).default(1), // Legacy - use headcountRequested
  headcountRequested: z.number().int().min(1).max(100).default(1), // PR-B: Number of slots to create
  reason: z.enum(REQUISITION_REASONS),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),

  requirements: z.array(z.string().max(500)).max(30).optional(),
  skills: z.array(z.string().max(100)).max(30).optional(),
  experienceYears: experienceRangeSchema.optional(),

  salaryRange: salaryRangeSchema.optional(),

  targetStartDate: z.coerce.date().optional(),
  closingDate: z.coerce.date().optional(),

  metadata: z.record(z.string(), z.any()).optional(),
});

export const createJobRequisitionSchema = jobRequisitionBaseSchema.refine(
  (data) => {
    // For Draft requisitions, all three are required
    // This will be enforced at the API level based on status
    return true;
  },
  { message: 'departmentId, jobTitleId, and positionId are required for Draft requisitions' }
);

export const updateJobRequisitionSchema = jobRequisitionBaseSchema.partial();

export const submitRequisitionSchema = z.object({
  comment: z.string().max(2000).optional(),
});

export const approveRequisitionSchema = z.object({
  approved: z.boolean(),
  comment: z.string().max(2000).optional(),
});

export const changeRequisitionStatusSchema = z.object({
  status: z.enum(REQUISITION_STATUSES),
  reason: z.string().max(2000).optional(),
});

// =============================================================================
// Candidate Schemas
// =============================================================================

export const createCandidateSchema = z.object({
  fullName: z.string().min(1).max(200).trim(),
  email: z.string().email().max(200).toLowerCase().trim().optional(),
  phone: z.string().max(50).trim().optional(),

  // Either requisitionId OR (departmentId + jobTitleId) - validated in route handler
  requisitionId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  jobTitleId: z.string().uuid().optional(),

  source: z.enum(CANDIDATE_SOURCES).default('DIRECT'),
  referredBy: z.string().uuid().nullable().optional(),

  notes: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateCandidateSchema = z.object({
  fullName: z.string().min(1).max(200).trim().optional(),
  email: z.string().email().max(200).toLowerCase().trim().optional(),
  phone: z.string().max(50).trim().optional(),
  notes: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const screenCandidateSchema = z.object({
  action: z.literal('screen').optional(),
  screeningScore: z.number().min(0).max(100).optional(),
  score: z.number().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
  decision: z.enum(['shortlisted', 'rejected', 'interview']).optional(),
}).transform((data) => {
  // Normalize: accept `score` as an alias for `screeningScore`
  const screeningScore = data.screeningScore ?? data.score;
  // Default decision based on screeningScore when not explicitly provided
  const decision = data.decision ?? (screeningScore != null && screeningScore >= 50 ? 'shortlisted' : 'rejected');
  return { ...data, screeningScore, decision } as {
    action?: 'screen';
    screeningScore?: number;
    score?: number;
    notes?: string;
    decision: 'shortlisted' | 'rejected' | 'interview';
  };
});

export const changeCandidateStatusSchema = z.object({
  status: z.enum(CANDIDATE_STATUSES),
  reason: z.string().max(2000).optional(),
});

export const createCandidateDocumentSchema = z.object({
  candidateId: z.string().uuid(),
  kind: z.enum(CANDIDATE_DOCUMENT_KINDS),
  fileName: z.string().min(1).max(500),
  storageKey: z.string().min(1).max(1000),
  mimeType: z.string().max(100).optional(),
  fileSize: z.number().int().min(0).optional(),
});

// Legacy alias
export const changeCandidateStageSchema = changeCandidateStatusSchema;

export const scheduleInterviewSchema = z.object({
  scheduledAt: z.coerce.date(),
  interviewers: z.array(z.string().uuid()).min(1).max(10),
  type: z.enum(['phone', 'video', 'in_person', 'technical', 'hr']),
});

export const completeInterviewSchema = z.object({
  interviewId: z.string().uuid(),
  status: z.enum(['completed', 'cancelled', 'no_show']),
  score: z.number().min(0).max(100).optional(),
  feedback: z.string().max(5000).optional(),
});

export const extendOfferSchema = z.object({
  amount: z.number().min(0),
  currency: z.string().length(3),
  notes: z.string().max(5000).optional(),
});

export const respondToOfferSchema = z.object({
  response: z.enum(['accepted', 'rejected', 'negotiating']),
  notes: z.string().max(2000).optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type CreateJobTitleInput = z.infer<typeof createJobTitleSchema>;
export type UpdateJobTitleInput = z.infer<typeof updateJobTitleSchema>;
export type CreateGradeInput = z.infer<typeof createGradeSchema>;
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ChangeEmployeeStatusInput = z.infer<typeof changeEmployeeStatusSchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type CommentRequestInput = z.infer<typeof commentRequestSchema>;
export type EscalateRequestInput = z.infer<typeof escalateRequestSchema>;
export type AssignRequestInput = z.infer<typeof assignRequestSchema>;
export type CloseRequestInput = z.infer<typeof closeRequestSchema>;
export type CreateJobRequisitionInput = z.infer<typeof createJobRequisitionSchema>;
export type UpdateJobRequisitionInput = z.infer<typeof updateJobRequisitionSchema>;
export type ApproveRequisitionInput = z.infer<typeof approveRequisitionSchema>;
export type ChangeRequisitionStatusInput = z.infer<typeof changeRequisitionStatusSchema>;
export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
export type ScreenCandidateInput = z.infer<typeof screenCandidateSchema>;
export type ChangeCandidateStatusInput = z.infer<typeof changeCandidateStatusSchema>;
export type CreateCandidateDocumentInput = z.infer<typeof createCandidateDocumentSchema>;

// =============================================================================
// Saudi-specific validators (used by import/export engine)
// =============================================================================

export function validateNationalId(id: string): { valid: boolean; error?: string } {
  if (!id) return { valid: false, error: 'National ID required' };
  if (!/^\d{10}$/.test(id)) return { valid: false, error: 'Must be 10 digits' };
  if (!id.startsWith('1') && !id.startsWith('2')) return { valid: false, error: 'Must start with 1 (Saudi) or 2 (Resident)' };
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = parseInt(id[i], 10);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  if (sum % 10 !== 0) return { valid: false, error: 'Invalid checksum' };
  return { valid: true };
}

export function validateSaudiPhone(phone: string): { valid: boolean; error?: string } {
  if (!phone) return { valid: false, error: 'Phone required' };
  const clean = phone.replace(/[\s\-()]/g, '');
  if (/^\+9665\d{8}$/.test(clean)) return { valid: true };
  if (/^05\d{8}$/.test(clean)) return { valid: true };
  if (/^5\d{8}$/.test(clean)) return { valid: true };
  return { valid: false, error: 'Must be Saudi mobile (+966 5X XXXX XXXX)' };
}

export function validateSaudiIBAN(iban: string): { valid: boolean; error?: string } {
  if (!iban) return { valid: false, error: 'IBAN required' };
  const clean = iban.replace(/\s/g, '').toUpperCase();
  if (!/^SA\d{2}[A-Z0-9]{20}$/.test(clean)) return { valid: false, error: 'Format: SA + 22 alphanumeric characters' };
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const numeric = rearranged.split('').map(c => { const code = c.charCodeAt(0); return code >= 65 ? String(code - 55) : c; }).join('');
  let remainder = 0;
  for (const ch of numeric) { remainder = (remainder * 10 + parseInt(ch, 10)) % 97; }
  if (remainder !== 1) return { valid: false, error: 'Invalid IBAN checksum' };
  return { valid: true };
}

export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email) return { valid: false, error: 'Email required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, error: 'Invalid email format' };
  return { valid: true };
}

export function validateDateRange(start: string | Date, end: string | Date): { valid: boolean; error?: string } {
  const s = new Date(start); const e = new Date(end);
  if (isNaN(s.getTime())) return { valid: false, error: 'Invalid start date' };
  if (isNaN(e.getTime())) return { valid: false, error: 'Invalid end date' };
  if (e < s) return { valid: false, error: 'End date must be after start date' };
  return { valid: true };
}

export function validateNotFutureBirthdate(date: string | Date): { valid: boolean; error?: string } {
  const d = new Date(date);
  if (isNaN(d.getTime())) return { valid: false, error: 'Invalid date' };
  if (d > new Date()) return { valid: false, error: 'Birthdate cannot be in the future' };
  const age = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (age < 15 || age > 100) return { valid: false, error: 'Age must be between 15 and 100' };
  return { valid: true };
}

export interface ImportError { row: number; field: string; error: string; value?: any }

export function validateEmployeeData(data: Record<string, any>, row: number): ImportError[] {
  const errors: ImportError[] = [];
  if (!data.nameEn && !data.nameAr) errors.push({ row, field: 'name', error: 'Name (English or Arabic) is required' });
  if (data.nationalId) { const r = validateNationalId(data.nationalId); if (!r.valid) errors.push({ row, field: 'nationalId', error: r.error!, value: data.nationalId }); }
  if (data.phone) { const r = validateSaudiPhone(data.phone); if (!r.valid) errors.push({ row, field: 'phone', error: r.error!, value: data.phone }); }
  if (data.email) { const r = validateEmail(data.email); if (!r.valid) errors.push({ row, field: 'email', error: r.error!, value: data.email }); }
  if (data.iban) { const r = validateSaudiIBAN(data.iban); if (!r.valid) errors.push({ row, field: 'iban', error: r.error!, value: data.iban }); }
  if (data.birthDate) { const r = validateNotFutureBirthdate(data.birthDate); if (!r.valid) errors.push({ row, field: 'birthDate', error: r.error!, value: data.birthDate }); }
  return errors;
}
