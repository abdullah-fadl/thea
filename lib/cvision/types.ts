/**
 * CVision (HR OS) - Type Definitions
 * 
 * All CVision entity interfaces and types.
 * Every record is tenant-scoped and supports soft delete.
 */

import { ObjectId } from '@/lib/cvision/infra/mongo-compat';

// =============================================================================
// Base Types
// =============================================================================

export interface CVisionBaseRecord {
  _id?: ObjectId;
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  createdBy: string;
  updatedBy: string;
}

// =============================================================================
// Organization Structure
// =============================================================================

export interface CVisionDepartment extends CVisionBaseRecord {
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  parentId?: string | null;
  managerId?: string | null;
  isActive: boolean;
  isArchived: boolean;
  sortOrder?: number;
}

export interface CVisionUnit extends CVisionBaseRecord {
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  departmentId: string;
  managerId?: string | null;
  headNurseId?: string | null;
  nursingManagerId?: string | null;
  minStaffDay?: number;
  minStaffNight?: number;
  minStaffEvening?: number;
  isActive: boolean;
  isArchived: boolean;
  sortOrder?: number;
}

/**
 * Budgeted Position (PR-D: Budget v1)
 * Represents a budgeted position at Department + JobTitle level
 * This is the new model for headcount budgeting
 */
export interface CVisionBudgetedPosition extends CVisionBaseRecord {
  departmentId: string; // FK to CVisionDepartment
  unitId?: string | null; // FK to CVisionUnit (optional)
  jobTitleId: string; // FK to CVisionJobTitle
  gradeId?: string | null; // FK to CVisionGrade (optional)
  positionCode: string; // Tenant-scoped short code (e.g., POS-NS-ER-RN-001), unique per tenant
  title?: string | null; // Optional display label
  budgetedHeadcount: number; // >= 0
  isActive: boolean; // Default true
  // Computed metrics (not stored, computed on-the-fly):
  // - occupiedHeadcount: count employees where positionId=this.id and status in (ACTIVE, PROBATION)
  // - openRequisitions: count requisitions where positionId=this.id and status=OPEN
  // - availableSlots: budgetedHeadcount - occupiedHeadcount - openRequisitions
}

/**
 * Legacy Position (department + jobTitle + grade junction)
 * Kept for backward compatibility
 * @deprecated Use CVisionBudgetedPosition instead
 */
export interface CVisionPosition extends CVisionBaseRecord {
  departmentId: string;
  jobTitleId: string;
  gradeId?: string | null;
  budgetedHeadcount: number;
  activeHeadcount: number; // Computed/derived from employees
  isActive: boolean;
  isArchived: boolean;
}

/**
 * Standalone Position (new model for PR-D)
 * Represents a position type (e.g., "Staff Nurse", "Charge Nurse")
 */
export interface CVisionPositionType extends CVisionBaseRecord {
  code: string; // Unique per tenant
  title: string;
  description?: string | null;
  isActive: boolean;
}

/**
 * Department-Position Assignment (junction table)
 * Links departments to positions
 */
export interface CVisionDepartmentPosition extends CVisionBaseRecord {
  departmentId: string;
  positionId: string; // References CVisionPositionType.id
  isActive: boolean;
}

/**
 * Position Slot (PR-B: Position Lifecycle)
 * Represents a single headcount slot with lifecycle (VACANT/FILLED/FROZEN)
 * Each slot = 1 headcount. Multiple slots reference a PositionBudget.
 */
export type PositionSlotStatus = 'VACANT' | 'FILLED' | 'FROZEN';

export interface CVisionPositionSlot extends CVisionBaseRecord {
  positionId: string; // FK to CVisionBudgetedPosition.id (budget definition)
  requisitionId?: string | null; // FK to CVisionJobRequisition.id (if created from requisition)
  employeeId?: string | null; // FK to CVisionEmployee.id (if filled)
  status: PositionSlotStatus; // VACANT | FILLED | FROZEN
  filledAt?: Date | null; // Set when status becomes FILLED
  frozenAt?: Date | null; // Set when status becomes FROZEN
  notes?: string | null;
  // Constraints:
  // - If status='FILLED' => employeeId required, filledAt required
  // - If status='VACANT' => employeeId must be null
  // - If status='FROZEN' => employeeId must be null
}

/**
 * Manpower Plan (Budget)
 * Defines budgeted headcount per department+position for a time period
 */
export interface CVisionManpowerPlan extends CVisionBaseRecord {
  departmentId: string;
  positionId: string; // References CVisionPositionType.id
  budgetedHeadcount: number; // >= 0
  effectiveFrom: Date;
  effectiveTo?: Date | null; // Nullable for open-ended plans
  note?: string | null;
  createdByUserId: string;
}

// =============================================================================
// Employees
// =============================================================================

/**
 * Employee Status Type
 *
 * CANONICAL FORMAT: UPPERCASE ('ACTIVE', 'PROBATION', 'RESIGNED', 'TERMINATED')
 * Database stores uppercase values. Use normalizeEmployeeStatus() for any lowercase input.
 */
export type EmployeeStatus =
  | 'ACTIVE' | 'PROBATION'
  | 'ON_ANNUAL_LEAVE' | 'ON_SICK_LEAVE' | 'ON_MATERNITY_LEAVE' | 'ON_UNPAID_LEAVE'
  | 'SUSPENDED' | 'SUSPENDED_WITHOUT_PAY'
  | 'NOTICE_PERIOD'
  | 'RESIGNED' | 'TERMINATED' | 'END_OF_CONTRACT' | 'RETIRED' | 'DECEASED';

/**
 * Normalize employee status to canonical uppercase format
 * Accepts both uppercase and lowercase input
 */
const VALID_STATUSES: Set<string> = new Set([
  'ACTIVE', 'PROBATION',
  'ON_ANNUAL_LEAVE', 'ON_SICK_LEAVE', 'ON_MATERNITY_LEAVE', 'ON_UNPAID_LEAVE',
  'SUSPENDED', 'SUSPENDED_WITHOUT_PAY',
  'NOTICE_PERIOD',
  'RESIGNED', 'TERMINATED', 'END_OF_CONTRACT', 'RETIRED', 'DECEASED',
]);

export function normalizeEmployeeStatus(status: string): EmployeeStatus {
  const normalized = status.toUpperCase();
  if (VALID_STATUSES.has(normalized)) return normalized as EmployeeStatus;
  if (normalized === 'ON_LEAVE') return 'ON_ANNUAL_LEAVE';
  throw new Error(`Invalid employee status: ${status}`);
}

export function isValidEmployeeStatus(status: string): boolean {
  return VALID_STATUSES.has(status.toUpperCase());
}

export interface CVisionEmployee extends CVisionBaseRecord {
  employeeNo: string;
  employeeNumber?: string; // Alias for employeeNo (backward compatibility)
  nationalId?: string | null;
  firstName: string;
  lastName: string;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  nationality?: string | null;
  departmentId: string;
  unitId?: string | null;
  nursingRole?: 'NURSING_MANAGER' | 'HEAD_NURSE' | 'STAFF_NURSE' | 'NURSE' | null;
  jobTitleId: string;
  positionId?: string | null; // References CVisionPositionType.id
  gradeId?: string | null;
  managerEmployeeId?: string | null;
  branchId?: string | null;
  workLocation?: string | null;
  status: EmployeeStatus;
  statusEffectiveAt: Date;
  statusChangedAt?: Date; // Alias for statusEffectiveAt (backward compatibility)
  statusReason?: string | null;
  hiredAt?: Date | null;
  probationEndDate?: Date | null;
  activatedAt?: Date | null; // Set when transitioning from PROBATION to ACTIVE
  resignedAt?: Date | null; // Set when transitioning to RESIGNED
  terminatedAt?: Date | null; // Set when transitioning to TERMINATED
  contractEndDate?: Date | null;
  userId?: string | null;
  isActive: boolean;
  isArchived: boolean;
  address?: Record<string, any> | null;
  emergencyContact?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

// =============================================================================
// Employee Contracts
// =============================================================================

export type ContractType = 'FIXED_TERM' | 'OPEN_ENDED' | 'PART_TIME' | 'PROBATION';
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'RENEWED';

export interface CVisionContract extends CVisionBaseRecord {
  contractNo: string;
  employeeId: string;
  type: ContractType;
  startDate: Date;
  endDate?: Date | null;
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  vacationDaysPerYear?: number;
  status: ContractStatus;
  isActive: boolean;
  renewedFromContractId?: string | null;
  terminationDate?: Date | null;
  terminationReason?: string | null;
}

export type JobPostingStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type KilloutQuestionType = 'YESNO' | 'MULTI' | 'TEXT';
export type ApplicationStatus = 'SUBMITTED' | 'DISQUALIFIED' | 'IN_REVIEW';

export interface CVisionJobPosting extends CVisionBaseRecord {
  departmentId: string;
  title: string;
  description: string;
  status: JobPostingStatus;
  seoSlug: string;
}

export interface CVisionKilloutQuestion extends CVisionBaseRecord {
  postingId: string;
  questionText: string;
  type: KilloutQuestionType;
  disqualifyRuleJson: Record<string, any>; // JSON rule for disqualification logic
  sortOrder?: number;
}

export interface CVisionApplication extends CVisionBaseRecord {
  postingId: string;
  candidateEmail: string;
  candidateName: string;
  answersJson: Record<string, any>; // JSON object mapping questionId -> answer
  status: ApplicationStatus;
  disqualifyReason?: string | null;
}

export type CvParseJobStatus = 'QUEUED' | 'DONE' | 'FAILED';
export type DocumentKind = 'CV' | 'CERTIFICATE' | 'OTHER' | 'cv' | 'certificate' | 'other';

// =============================================================================
// Recruitment (Candidates & Requisitions)
// =============================================================================

export type CandidateStatus = 'applied' | 'new' | 'screening' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected' | 'APPLIED' | 'NEW' | 'SCREENING' | 'SCREENED' | 'SHORTLISTED' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
export type CandidateSource = 'PORTAL' | 'REFERRAL' | 'AGENCY' | 'DIRECT' | 'OTHER' | 'CV_INBOX' | 'LINKEDIN' | 'portal' | 'referral' | 'agency' | 'direct' | 'other' | 'cv_inbox' | 'linkedin';

// Interview Round structure
export type InterviewType = 'phone' | 'video' | 'in_person' | 'technical' | 'panel' | 'hr' | 'PHONE' | 'VIDEO' | 'IN_PERSON' | 'TECHNICAL' | 'PANEL' | 'HR';
export type InterviewStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type InterviewDecision = 'pass' | 'fail' | 'hold' | 'next_round' | 'offer' | 'pending' | 'PASS' | 'FAIL' | 'HOLD' | 'NEXT_ROUND' | 'OFFER' | 'PENDING';

export interface CandidateInterview {
  id: string;
  roundNumber: number;
  type: InterviewType;
  status: InterviewStatus;
  scheduledDate: string; // ISO date
  scheduledTime: string; // HH:mm
  duration?: number; // minutes
  location?: string;
  meetingLink?: string;
  interviewers: string[]; // Names or user IDs
  notes?: string;
  // Results (filled after interview)
  score?: number; // 1-10
  feedback?: string;
  decision?: InterviewDecision;
  aiAnalysis?: {
    confidence?: number;
    engagement?: number;
    stressLevel?: number;
    emotionSummary?: string;
    observations?: string[];
  };
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  createdBy: string;
}

// Offer status types
export type OfferStatus = 'draft' | 'sent' | 'accepted_pending_approval' | 'negotiating' | 'approved' | 'rejected' | 'hr_rejected' | 'expired';

export interface CandidateOffer {
  id: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  totalSalary: number;
  currency: string;
  startDate: string;
  contractType: 'full_time' | 'part_time' | 'contract' | 'internship';
  probationPeriod: number; // days
  benefits: string[];
  expiryDate: string;
  notes?: string;
  status: OfferStatus;
  sentAt: string;
  sentBy: string;
  // Candidate response tracking
  candidateResponse: 'accepted' | 'rejected' | 'negotiating' | null;
  candidateResponseAt: string | null;
  candidateResponseNotes: string | null;
  // HR approval tracking
  hrApprovalStatus: 'pending' | 'approved' | 'rejected';
  hrApprovedBy: string | null;
  hrApprovedAt: string | null;
  hrApprovalNotes: string | null;
}

export interface CVisionCandidate extends CVisionBaseRecord {
  requisitionId?: string | null;
  applicationId?: string | null; // Link to public application
  departmentId?: string | null; // Direct department link (when no requisition)
  jobTitleId?: string | null; // Direct job title link (when no requisition)
  fullName: string;
  email?: string | null;
  phone?: string | null;
  source: CandidateSource;
  referredBy?: string | null;
  status: CandidateStatus;
  statusChangedAt: Date;
  statusReason?: string | null;
  screeningScore?: number | null;
  notes?: string | null;
  screenedBy?: string | null;
  screenedAt?: Date | null;
  interviews?: CandidateInterview[] | null; // Array of interview rounds
  // Legacy offer fields (for backward compatibility)
  offerExtendedAt?: Date | null;
  offerAmount?: number | null;
  offerCurrency?: string | null;
  offerStatus?: string | null; // 'pending' | 'accepted' | 'rejected'
  offerResponseAt?: Date | null;
  // New structured offer object
  offer?: CandidateOffer | null;
  hiredAt?: Date | null;
  employeeId?: string | null; // Link to employee if hired
  isArchived: boolean;
  metadata?: Record<string, any> | null;
}

export interface CVisionCvParseJob extends CVisionBaseRecord {
  candidateId: string;
  documentId: string;
  status: CvParseJobStatus;
  extractedRawText?: string | null; // Phase 1: Raw text extraction only (no semantic parsing)
  metaJson?: Record<string, any> | null; // { pages, mimeType, parserVersion, fileSize }
  // Deprecated Phase 1 fields (kept for backward compatibility, will be removed in Phase 3)
  extractedJson?: Record<string, any> | null; // Phase 3: Structured extracted data (AI)
  extractedText?: string | null; // Deprecated: use extractedRawText
  errors?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface CVisionCandidateDocument extends CVisionBaseRecord {
  candidateId: string;
  kind: DocumentKind;
  fileName: string;
  storageKey: string; // Placeholder for S3/storage key
  mimeType?: string | null;
  fileSize?: number | null;
  extractedText?: string | null;
}

export type RequisitionStatus = 'draft' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'open' | 'closed' | 'cancelled' | 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
export type RequisitionReason = 'new_position' | 'replacement' | 'backfill' | 'expansion' | 'other' | 'new_role' | 'temp';

export interface RequisitionApproval {
  userId: string;
  role: string;
  approved: boolean;
  comment?: string;
  approvedAt: Date;
  decidedAt?: Date | null; // When the approver took action
  status?: 'pending' | 'approved' | 'rejected' | 'skipped' | string; // Approval step status
  stepOrder?: number; // Order in multi-step chain (0 = first approver)
  stepLabel?: string; // Human-readable label (e.g. "Department Manager", "HR Admin")
}

export interface CVisionJobRequisition extends CVisionBaseRecord {
  requisitionNumber: string;
  title: string;
  description?: string | null;
  departmentId: string;
  unitId?: string | null;
  jobTitleId?: string | null;
  gradeId?: string | null;
  positionId?: string | null; // FK to CVisionBudgetedPosition.id (position template/budget)
  headcount: number; // Legacy field - use headcountRequested
  headcountRequested: number; // Number of slots to create when opening (PR-B)
  reason: RequisitionReason;
  employmentType?: string | null;
  requirements?: Record<string, any> | null; // JSON array
  skills?: Record<string, any> | null; // JSON array
  experienceYears?: Record<string, any> | null; // JSON object
  salaryRange?: Record<string, any> | null; // JSON object
  status: RequisitionStatus;
  statusChangedAt: Date;
  statusReason?: string | null;
  approvalsJson: RequisitionApproval[] | Record<string, any>; // JSON array of approvals
  createdByUserId: string;
  submittedAt?: Date | null;
  submittedBy?: string | null;
  approvedAt?: Date | null;
  approvedBy?: string | null;
  openedAt?: Date | null;
  closedAt?: Date | null;
  targetStartDate?: Date | null;
  closingDate?: Date | null;
  applicantCount: number; // Computed from candidates
  isArchived: boolean;
  metadata?: Record<string, any> | null;
  // Derived fields (computed, not stored):
  // - openPositionsCount: count(slots where requisitionId=this.id and status=VACANT)
  // - filledPositionsCount: count(slots where requisitionId=this.id and status=FILLED)
}

// =============================================================================
// Requests (Internal Ticketing)
// =============================================================================

export type RequestType = 'leave' | 'salary_certificate' | 'employment_letter' | 'expense_claim' | 'complaint' | 'transfer' | 'training' | 'equipment' | 'payroll_issue' | 'other';
export type RequestStatus = 'open' | 'in_review' | 'approved' | 'rejected' | 'escalated' | 'closed';
export type RequestConfidentiality = 'normal' | 'confidential' | 'anonymous';
export type RequestOwnerRole = 'manager' | 'hr' | 'compliance';
export type RequestEventType = 'created' | 'comment' | 'status_change' | 'escalated' | 'assigned' | 'attachment_added';

export interface CVisionRequest extends CVisionBaseRecord {
  requestNumber: string;
  type: RequestType;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  requesterEmployeeId: string;
  targetManagerEmployeeId?: string | null;
  departmentId: string;
  status: RequestStatus;
  statusChangedAt: Date;
  statusReason?: string | null;
  confidentiality: RequestConfidentiality;
  currentOwnerRole: RequestOwnerRole;
  assignedToUserId?: string | null;
  assignedToRole?: RequestOwnerRole | null;
  assignedAt?: Date | null;
  escalatedAt?: Date | null;
  escalationReason?: string | null;
  escalatedFromRole?: RequestOwnerRole | null;
  slaDueAt?: Date | null;
  slaBreached: boolean;
  closedAt?: Date | null;
  closedBy?: string | null;
  resolution?: string | null;
  resolvedAt?: Date | null;
  attachments?: Record<string, any> | null;
  isArchived: boolean;
  metadata?: Record<string, any> | null;
}

export interface CVisionRequestEvent extends CVisionBaseRecord {
  requestId: string;
  actorUserId: string;
  actorRole?: string | null;
  eventType: RequestEventType;
  payloadJson: Record<string, any>;
}

// =============================================================================
// Payroll
// =============================================================================

export type LoanStatus = 'pending' | 'active' | 'paid_off' | 'cancelled' | 'PENDING' | 'ACTIVE' | 'PAID_OFF' | 'CANCELLED';
export type PayrollRunStatus = 'DRAFT' | 'DRY_RUN' | 'APPROVED' | 'PAID' | 'draft' | 'dry_run' | 'approved' | 'paid';

export interface CVisionPayrollProfile extends CVisionBaseRecord {
  employeeId: string;
  baseSalary: number;
  allowancesJson: Record<string, number>; // { "housing": 5000, "transport": 2000, ... }
  deductionsJson: Record<string, number>; // { "insurance": 500, "tax": 1000, ... }
  bankIban?: string | null;
  wpsId?: string | null;
  attendanceData?: Record<string, any> | null; // Attendance integration data (populated by payroll calculator)
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionLoan extends CVisionBaseRecord {
  employeeId: string;
  loanNumber: string;
  principal: number;
  monthlyDeduction: number;
  remaining: number;
  status: LoanStatus;
  startDate: Date;
  endDate?: Date | null;
  notes?: string | null;
  isArchived: boolean;
}

export interface CVisionPayrollRun extends CVisionBaseRecord {
  period: string; // Format: YYYY-MM (e.g., "2024-01")
  status: PayrollRunStatus;
  /** PG column name is "totals" (Json) */
  totals: {
    totalGross: number;
    totalNet: number;
    employeeCount: number;
    totalAllowances?: number;
    totalDeductions?: number;
    totalLoanDeductions?: number;
  };
  /** @deprecated Use totals — kept for backward compat with code that reads the old field */
  totalsJson?: {
    totalGross: number;
    totalNet: number;
    employeeCount: number;
    totalAllowances?: number;
    totalDeductions?: number;
    totalLoanDeductions?: number;
  };
  approvedAt?: Date | null;
  approvedBy?: string | null;
  paidAt?: Date | null;
  paidBy?: string | null;
  notes?: string | null;
  isArchived: boolean;
}

export interface CVisionPayslip extends CVisionBaseRecord {
  runId: string;
  employeeId: string;
  gross: number;
  net: number;
  /** PG column name is "breakdown" (Json) */
  breakdown: {
    baseSalary: number;
    allowances: Record<string, number>;
    deductions: Record<string, number>;
    loanDeduction?: number;
    totalAllowances?: number;
    totalDeductions?: number;
    [key: string]: any;
  };
  /** @deprecated Use breakdown — kept for backward compat */
  breakdownJson?: {
    baseSalary: number;
    allowances: Record<string, number>;
    deductions: Record<string, number>;
    loanDeduction?: number;
    totalAllowances?: number;
    totalDeductions?: number;
  };
  isArchived: boolean;
}

export interface CVisionPayrollExport extends CVisionBaseRecord {
  runId: string;
  format: string; // WPS, CSV, BANK_FORMAT
  fileName: string;
  fileSize?: number | null;
  rowCount: number;
  checksum?: string | null;
  exportedAt: Date;
  exportedBy: string;
  metadataJson?: Record<string, any> | null;
  isArchived: boolean;
}

// =============================================================================
// CV Inbox (Bulk Upload)
// =============================================================================

export type CvInboxItemStatus = 'UPLOADED' | 'PARSED' | 'SUGGESTED' | 'ASSIGNED' | 'REJECTED';

export interface CVisionCvInboxBatch extends CVisionBaseRecord {
  createdByUserId: string; // User who created the batch
  itemCount: number; // Total items in batch
  parsedCount: number; // Items successfully parsed
  suggestedCount: number; // Items with suggestions
  assignedCount: number; // Items assigned to requisitions
  isArchived: boolean;
}

export interface CVisionCvInboxItem extends CVisionBaseRecord {
  batchId: string;
  fileName: string;
  storageKey?: string | null; // Placeholder for file storage
  mimeType?: string | null;
  fileSize?: number | null;
  extractedRawText?: string | null; // Phase 1: Raw text only (TEXT nullable)
  status: CvInboxItemStatus;
  parseError?: string | null; // Error message if parsing failed
  suggestedRequisitionIdsJson?: string[] | null; // Array of requisition IDs (top 3 ordered)
  suggestedScoresJson?: Record<string, number> | null; // { requisitionId: score } for debugging
  assignedRequisitionId?: string | null; // Default to top-1 suggestion, can be overridden
  assignedCandidateId?: string | null; // Created candidate ID after assignment
  assignedAt?: Date | null;
  assignedBy?: string | null;
}

// =============================================================================
// Employee Profile (Live Employee File)
// =============================================================================

export type ProfileSectionKey = 'PERSONAL' | 'EMPLOYMENT' | 'FINANCIAL' | 'CONTRACT';

export interface ProfileFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select' | 'textarea' | 'email' | 'phone' | 'json';
  required?: boolean;
  options?: string[]; // For select type
  validation?: Record<string, any>; // Additional validation rules
  source?: 'employee' | 'profile' | 'computed' | 'departments' | 'departmentPositions'; // Field data source
  dependsOn?: string; // Key of field this depends on
}

export interface CVisionProfileSectionSchema extends CVisionBaseRecord {
  sectionKey: ProfileSectionKey;
  version: number;
  schemaJson: {
    fields: ProfileFieldDefinition[];
  };
  isActive: boolean;
  createdByUserId: string;
}

export interface CVisionEmployeeProfileSection extends CVisionBaseRecord {
  employeeId: string;
  sectionKey: ProfileSectionKey;
  schemaVersion: number; // References active schema version at time of write
  dataJson: Record<string, any>;
}

export interface CVisionEmployeeProfileSectionHistory extends CVisionBaseRecord {
  employeeId: string;
  sectionKey: ProfileSectionKey;
  schemaVersion: number;
  prevDataJson: Record<string, any>;
  nextDataJson: Record<string, any>;
  changedByUserId: string;
  changeReason?: string | null;
}

// =============================================================================
// Employee Status History
// =============================================================================

export interface CVisionEmployeeStatusHistory extends CVisionBaseRecord {
  employeeId: string;
  fromStatus: EmployeeStatus | string | null;
  toStatus: EmployeeStatus | string;
  reason: string;
  effectiveDate: Date;
  lastWorkingDay?: Date | string | null;
  endOfServiceAmount?: number | null;
  notes?: string | null;
}

// =============================================================================
// Job Structure
// =============================================================================

export interface CVisionJobTitle extends CVisionBaseRecord {
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  departmentId: string; // Required FK to CVisionDepartment
  unitId?: string | null; // Optional FK to CVisionUnit
  gradeId?: string | null;
  isActive: boolean;
  isArchived?: boolean;
  requirements?: string[];
  responsibilities?: string[];
}

export interface CVisionGrade extends CVisionBaseRecord {
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  level: number;
  minSalary?: number;
  maxSalary?: number;
  currency?: string; // ISO 4217
  isActive: boolean;
  jobTitleId?: string | null; // Legacy - single job title (deprecated)
  jobTitleIds?: string[]; // New - supports multiple job titles
}

// =============================================================================
// Audit Logging Types
// =============================================================================

export type CVisionAuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'SOFT_DELETE'
  | 'RESTORE'
  | 'STATUS_CHANGE'
  | 'APPROVE'
  | 'REJECT'
  | 'ASSIGN'
  | 'ESCALATE'
  | 'SUBMIT'
  | 'CLOSE'
  | 'ARCHIVE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT'
  | 'BULK_ACTION'
  // Entity-specific actions (legacy support)
  | 'department_create'
  | 'department_update'
  | 'department_archive'
  | 'department_delete'
  | 'employee_create'
  | 'employee_update'
  | 'employee_archive'
  | 'employee_delete'
  | 'job_titles_delete_all'
  | 'grades_delete_all'
  | 'positions_delete_all'
  | 'employee_profile_update'
  | 'employee_status_change'
  | 'employee_status_transition'
  | 'employee_user_access_disabled'
  // Job title actions
  | 'job_title_create'
  | 'job_title_update'
  | 'job_title_delete'
  // Grade actions
  | 'grade_create'
  | 'grade_update'
  | 'grade_delete'
  // Position actions
  | 'position_create'
  | 'position_update'
  | 'position_delete'
  | 'budgeted_position_create'
  | 'budgeted_position_update'
  | 'budgeted_position_delete'
  | 'department_position_assign'
  | 'department_position_remove'
  // Manpower actions
  | 'manpower_plan_create'
  | 'manpower_plan_update'
  // Profile schema actions
  | 'profile_schema_version_created'
  // CV parsing actions
  | 'cv_parse_job_run'
  // Payroll actions
  | 'payroll_run_create'
  | 'payroll_run_approve'
  | 'payroll_run_dry_run'
  | 'payroll_run_export_wps'
  | 'payroll_run_mark_paid'
  | 'payroll_profile_create'
  | 'payroll_profile_update'
  | 'payroll_profile_archive'
  // Loan actions
  | 'loan_create'
  | 'loan_update'
  | 'loan_cancel'
  // Payslip actions
  | 'payslip_create'
  | 'payslip_update'
  // Owner/authz actions
  | 'owner_access'
  | 'authz_deny'
  // Candidate/recruitment actions
  | 'candidate_cv_upload'
  | 'candidate_update'
  | 'candidate_hire'
  | 'candidate_quick_hire'
  | 'candidate_screen'
  | 'candidate_stage_change'
  | 'candidate_create'
  | 'candidate_delete'
  | 'interview_scheduled'
  | 'interview_updated'
  // CV Inbox batch actions
  | 'cv_inbox_batch_create'
  | 'cv_inbox_batch_upload'
  | 'cv_inbox_batch_parse'
  | 'cv_inbox_batch_suggest'
  | 'cv_inbox_batch_assign_all'
  // CV inbox item actions
  | 'cv_inbox_item_assign'
  // Requisition actions
  | 'requisition_create'
  | 'requisition_update'
  | 'requisition_delete'
  | 'CVISION_REQUISITION_POSITION_ASSIGNED'
  | 'CVISION_SLOTS_CREATED'
  // Request actions
  | 'request_create'
  | 'request_update'
  | 'request_approve'
  | 'request_reject'
  | 'request_escalate'
  // Assignment actions
  | 'assignment_create'
  | 'assignment_end'
  | 'assignment_cancel'
  // Unit actions
  | 'unit_create'
  | 'unit_update'
  | 'unit_archive'
  // Leave actions
  | 'leave_employee_confirm'
  | 'leave_employee_reject'
  | 'leave_manager_approve'
  | 'leave_manager_reject'
  // Additional requisition actions
  | 'requisition_approve'
  | 'requisition_reject'
  | 'requisition_open'
  | 'requisition_close'
  | 'requisition_cancel'
  | 'CVISION_REQUISITION_OPENED'
  | 'CVISION_REQUISITION_CLOSED'
  | 'CVISION_REQUISITION_CANCELLED'
  // Performance review actions
  | 'review_cycle_create'
  | 'review_cycle_complete'
  | 'self_review_submit'
  | 'manager_review_submit'
  | 'review_acknowledge'
  | 'review_goals_update'
  | 'self_review_admin_submit'
  | 'reviews_reset'
  // Document actions
  | 'document_create'
  | 'document_update'
  | 'document_delete'
  // Offboarding actions
  | 'offboarding_initiate'
  | 'offboarding_complete'
  | 'offboarding_clearance_complete'
  | 'offboarding_settlement_calculate'
  | 'offboarding_exit_interview'
  // Leave accrual actions
  | 'leave_accrual'
  | 'leave_year_init'
  // Self-service actions
  | 'self_service_profile_update'
  | 'self_service_leave_request'
  | 'leave_request_create'
  // Training actions
  | 'training_course_update'
  | 'training_course_deactivate';

export type CVisionResourceType =
  | 'EMPLOYEE'
  | 'DEPARTMENT'
  | 'UNIT'
  | 'JOB_TITLE'
  | 'GRADE'
  | 'POSITION'
  | 'BUDGETED_POSITION'
  | 'POSITION_SLOT'
  | 'REQUISITION'
  | 'CANDIDATE'
  | 'REQUEST'
  | 'PAYROLL_PROFILE'
  | 'PAYROLL_RUN'
  | 'PAYSLIP'
  | 'LOAN'
  | 'USER'
  | 'CV_INBOX'
  | 'CV_PARSE_JOB'
  | 'JOB_POSTING'
  | 'APPLICATION'
  | 'PROFILE_SCHEMA'
  | 'MANPOWER_PLAN'
  | 'AUTHZ'
  | 'DEPARTMENT_POSITION'
  // Lowercase aliases (legacy support)
  | 'employee'
  | 'department'
  | 'grade'
  | 'job_title'
  | 'position'
  | 'employee_profile'
  | 'authz'
  | 'cv_parse_job'
  | 'manpower_plan'
  | 'budgeted_position'
  | 'department_position'
  | 'profile_schema'
  | 'candidate'
  | 'cv_inbox_batch'
  | 'cv_inbox_item'
  | 'requisition'
  | 'request'
  | 'unit'
  | 'assignment'
  | 'leave'
  | 'REVIEW_CYCLE'
  | 'PERFORMANCE_REVIEW'
  | 'review_cycle'
  | 'performance_review'
  | 'document'
  | 'training';

export interface CVisionAuditLog extends CVisionBaseRecord {
  action: CVisionAuditAction;
  resourceType: CVisionResourceType;
  resourceId: string;
  actorUserId: string;
  actorRole: string;
  actorEmail?: string;
  success: boolean;
  errorMessage?: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// List/Pagination Types
// =============================================================================

export interface CVisionListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export interface CVisionListResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// =============================================================================
// Role & Permission Types
// =============================================================================

export type CVisionRole =
  | 'thea-owner'
  | 'owner'
  | 'admin'
  | 'hr_manager'
  | 'hr_officer'
  | 'department_head'
  | 'manager'
  | 'employee'
  | 'recruiter'
  | 'payroll_officer'
  | 'viewer';

export interface CVisionRoleCapabilities {
  canManageEmployees: boolean;
  canManageDepartments: boolean;
  canManageRequisitions: boolean;
  canManageCandidates: boolean;
  canManagePayroll: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
  canApproveRequests: boolean;
  canExportData: boolean;
}

export const CVISION_ROLE_CAPABILITIES: Record<CVisionRole, CVisionRoleCapabilities> = {
  'thea-owner': {
    canManageEmployees: true,
    canManageDepartments: true,
    canManageRequisitions: true,
    canManageCandidates: true,
    canManagePayroll: true,
    canViewReports: true,
    canManageSettings: true,
    canApproveRequests: true,
    canExportData: true,
  },
  'owner': {
    canManageEmployees: true,
    canManageDepartments: true,
    canManageRequisitions: true,
    canManageCandidates: true,
    canManagePayroll: true,
    canViewReports: true,
    canManageSettings: true,
    canApproveRequests: true,
    canExportData: true,
  },
  'admin': {
    canManageEmployees: true,
    canManageDepartments: true,
    canManageRequisitions: true,
    canManageCandidates: true,
    canManagePayroll: true,
    canViewReports: true,
    canManageSettings: true,
    canApproveRequests: true,
    canExportData: true,
  },
  'hr_manager': {
    canManageEmployees: true,
    canManageDepartments: true,
    canManageRequisitions: true,
    canManageCandidates: true,
    canManagePayroll: true,
    canViewReports: true,
    canManageSettings: false,
    canApproveRequests: true,
    canExportData: true,
  },
  'hr_officer': {
    canManageEmployees: true,
    canManageDepartments: false,
    canManageRequisitions: true,
    canManageCandidates: true,
    canManagePayroll: false,
    canViewReports: true,
    canManageSettings: false,
    canApproveRequests: false,
    canExportData: false,
  },
  'department_head': {
    canManageEmployees: false,
    canManageDepartments: false,
    canManageRequisitions: true,
    canManageCandidates: true,
    canManagePayroll: false,
    canViewReports: true,
    canManageSettings: false,
    canApproveRequests: true,
    canExportData: false,
  },
  'manager': {
    canManageEmployees: false,
    canManageDepartments: false,
    canManageRequisitions: false,
    canManageCandidates: false,
    canManagePayroll: false,
    canViewReports: true,
    canManageSettings: false,
    canApproveRequests: true,
    canExportData: false,
  },
  'employee': {
    canManageEmployees: false,
    canManageDepartments: false,
    canManageRequisitions: false,
    canManageCandidates: false,
    canManagePayroll: false,
    canViewReports: false,
    canManageSettings: false,
    canApproveRequests: false,
    canExportData: false,
  },
  'recruiter': {
    canManageEmployees: false,
    canManageDepartments: false,
    canManageRequisitions: true,
    canManageCandidates: true,
    canManagePayroll: false,
    canViewReports: true,
    canManageSettings: false,
    canApproveRequests: false,
    canExportData: false,
  },
  'payroll_officer': {
    canManageEmployees: false,
    canManageDepartments: false,
    canManageRequisitions: false,
    canManageCandidates: false,
    canManagePayroll: true,
    canViewReports: true,
    canManageSettings: false,
    canApproveRequests: false,
    canExportData: true,
  },
  'viewer': {
    canManageEmployees: false,
    canManageDepartments: false,
    canManageRequisitions: false,
    canManageCandidates: false,
    canManagePayroll: false,
    canViewReports: true,
    canManageSettings: false,
    canApproveRequests: false,
    canExportData: false,
  },
};

// =============================================================================
// Insurance
// =============================================================================

export interface CVisionInsurancePlan {
  planId: string;
  name: string;
  tier: string;
  monthlyPremium: number;
  annualPremium: number;
  deductible?: number;
  copay?: number;
  networkType?: string;
  benefits?: string[];
  maxCoverage?: number;
}

export interface CVisionInsuranceProvider extends CVisionBaseRecord {
  name: string;
  nameAr?: string;
  contactInfo?: Record<string, any> | string | null;
  plans?: CVisionInsurancePlan[];
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionInsurancePolicy extends CVisionBaseRecord {
  policyNumber: string;
  policyId?: string;
  providerId: string;
  planId: string;
  planName?: string;
  providerName?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  isActive: boolean;
  isArchived: boolean;
  metadata?: Record<string, any> | null;
}

export type InsuranceEnrollmentStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'PENDING' | 'CANCELLED';

export interface InsuranceDependent {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CVisionEmployeeInsurance extends CVisionBaseRecord {
  employeeId: string;
  policyId: string;
  status: InsuranceEnrollmentStatus;
  tier: string;
  monthlyPremium: number;
  cardNumber?: string | null;
  membershipNumber?: string | null;
  expiryDate?: Date | null;
  startDate?: Date | null;
  dependents: InsuranceDependent[];
  isArchived: boolean;
  metadata?: Record<string, any> | null;
}

export interface CVisionInsuranceClaim extends CVisionBaseRecord {
  employeeId: string;
  policyId?: string;
  claimNumber?: string;
  type?: string;
  amount: number;
  approvedAmount?: number;
  status: string;
  submittedDate: Date;
  processedDate?: Date | null;
  description?: string | null;
  documents?: Record<string, any>[] | null;
  isArchived: boolean;
}

export interface CVisionInsuranceRequest extends CVisionBaseRecord {
  employeeId: string;
  requestType: string;
  status: string;
  submittedAt: Date;
  processedAt?: Date | null;
  processedBy?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  isArchived: boolean;
}

// =============================================================================
// Disciplinary Actions
// =============================================================================

export type DisciplinaryType =
  | 'VERBAL_WARNING' | 'FIRST_WRITTEN' | 'SECOND_WRITTEN'
  | 'FINAL_WARNING' | 'SUSPENSION' | 'TERMINATION';

export type DisciplinarySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DisciplinaryStatus =
  | 'DRAFT' | 'PENDING_REVIEW' | 'ISSUED' | 'ACKNOWLEDGED'
  | 'APPEALED' | 'APPEAL_UPHELD' | 'APPEAL_OVERTURNED'
  | 'REVOKED' | 'EXPIRED';

export interface CVisionDisciplinary extends CVisionBaseRecord {
  warningNumber: string;
  employeeId: string;
  employeeName: string;
  department: string;
  jobTitle?: string;
  type: DisciplinaryType;
  severity: DisciplinarySeverity;
  category: string;
  incidentDate: Date;
  incidentDescription: string;
  incidentDescriptionAr?: string;
  location?: string | null;
  witnesses?: string[];
  evidence?: string[];
  laborLawArticle?: string | null;
  companyPolicyRef?: string | null;
  previousWarnings: number;
  escalationLevel: number;
  actionTaken: string;
  actionTakenAr?: string;
  suspensionDays: number;
  salaryDeduction: number;
  salaryDeductionPercentage: number;
  status: DisciplinaryStatus;
  acknowledgedAt?: Date | null;
  employeeResponse?: string | null;
  appealDate?: Date | null;
  appealReason?: string | null;
  appealDecision?: string | null;
  appealDecidedBy?: string | null;
  appealDecidedAt?: Date | null;
  expiryDate: Date;
  isActive: boolean;
  issuedBy: string;
  issuedAt?: Date | null;
}

// =============================================================================
// Promotions
// =============================================================================

export type PromotionType = 'GRADE' | 'TITLE' | 'LATERAL' | 'DEPARTMENT' | 'COMPREHENSIVE';
export type PromotionStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  | 'EFFECTIVE' | 'CANCELLED';

export interface PromotionSnapshot {
  department: string;
  departmentId: string;
  jobTitle: string;
  jobTitleId: string;
  gradeId: string | null;
  grade: string | null;
  basicSalary: number;
}

export interface PromotionProposed extends PromotionSnapshot {
  salaryChange?: number;
  salaryChangePercent?: number;
  housingAllowance?: number;
  transportAllowance?: number;
}

export interface CVisionPromotion extends CVisionBaseRecord {
  promotionNumber?: string;
  employeeId: string;
  employeeName: string;
  type: PromotionType;
  status: PromotionStatus;
  current: PromotionSnapshot;
  proposed: PromotionProposed;
  reason?: string | null;
  effectiveDate?: Date | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  rejectedBy?: string | null;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;
  notes?: string | null;
  isArchived: boolean;
}

// =============================================================================
// Muqeem (Iqama & Visa Management)
// =============================================================================

export type IqamaStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'RENEWED' | 'CANCELLED';
export type VisaType = 'WORK' | 'EXIT_REENTRY_SINGLE' | 'EXIT_REENTRY_MULTIPLE' | 'FINAL_EXIT' | 'TRANSIT' | 'VISIT';
export type AbsherStatus = 'VERIFIED' | 'PENDING' | 'MISMATCH' | 'NOT_CHECKED';

export interface MuqeemExitReentryVisa {
  id: string;
  type: 'SINGLE' | 'MULTIPLE';
  visaNumber: string;
  issueDate: string;
  expiryDate: string;
  duration: number;
  departureDate?: string | null;
  returnDate?: string | null;
  destination?: string | null;
  status: 'ISSUED' | 'DEPARTED' | 'RETURNED' | 'EXPIRED' | 'CANCELLED';
}

export interface MuqeemDependent {
  id: string;
  name: string;
  relationship: 'SPOUSE' | 'SON' | 'DAUGHTER' | 'PARENT';
  iqamaNumber?: string | null;
  iqamaExpiryDate?: string | null;
  dateOfBirth?: string | null;
  passportNumber?: string | null;
}

export interface CVisionMuqeemRecord extends CVisionBaseRecord {
  employeeId: string;
  employeeName: string;
  department: string;
  nationality: string;
  iqamaNumber: string;
  iqamaIssueDate: string;
  iqamaExpiryDate: string;
  iqamaStatus: IqamaStatus;
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportStatus: string;
  visaType: VisaType;
  visaNumber: string;
  visaIssueDate: string;
  visaExpiryDate: string;
  visaStatus: string;
  exitReentryVisas: MuqeemExitReentryVisa[];
  lastAbsherCheck?: string | null;
  absherStatus: AbsherStatus;
  absherNotes?: string | null;
  insuranceProvider?: string | null;
  insuranceNumber?: string | null;
  insuranceExpiryDate?: string | null;
  iqamaRenewalCost?: number | null;
  visaCost?: number | null;
  insuranceCost?: number | null;
  totalAnnualCost?: number | null;
  sponsorName: string;
  sponsorId: string;
  dependents: MuqeemDependent[];
}

export type MuqeemAlertType = 'IQAMA_EXPIRY' | 'PASSPORT_EXPIRY' | 'VISA_EXPIRY' | 'INSURANCE_EXPIRY' | 'EXIT_REENTRY_EXPIRY';
export type MuqeemAlertSeverity = 'INFO' | 'WARNING' | 'URGENT' | 'CRITICAL';

export interface CVisionMuqeemAlert extends CVisionBaseRecord {
  employeeId: string;
  employeeName: string;
  type: MuqeemAlertType;
  severity: MuqeemAlertSeverity;
  daysRemaining: number;
  expiryDate: string;
  documentNumber: string;
  message: string;
  isRead: boolean;
  isResolved: boolean;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

// =============================================================================
// Shift Assignments
// =============================================================================

export type AssignmentType = 'LOAN' | 'TRAINING' | 'FLOAT' | 'PULL_OUT';
export type AssignmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface CVisionShiftAssignment extends CVisionBaseRecord {
  employeeId: string;
  originalUnitId: string;
  assignedUnitId: string | null;
  assignmentType: AssignmentType;
  startDate: Date;
  endDate: Date;
  reason?: string;
  hoursPerWeek?: number;
  status: AssignmentStatus;
  requestedBy: string;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

// =============================================================================
// Leaves
// =============================================================================

export type LeaveType =
  | 'ANNUAL' | 'SICK' | 'MATERNITY' | 'PATERNITY' | 'EMERGENCY'
  | 'UNPAID' | 'BEREAVEMENT' | 'HAJJ' | 'MARRIAGE' | 'STUDY' | 'COMPASSIONATE';
export type LeaveStatus =
  | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'IN_PROGRESS' | 'COMPLETED';

export interface CVisionLeave extends CVisionBaseRecord {
  employeeId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  days: number;
  reason?: string | null;
  status: LeaveStatus;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  rejectedBy?: string | null;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;
  attachments?: Record<string, any>[] | null;
  isArchived: boolean;
  metadata?: Record<string, any> | null;
}

export interface CVisionLeaveBalance extends CVisionBaseRecord {
  employeeId: string;
  leaveType: LeaveType;
  year: number;
  entitled: number;
  used: number;
  remaining: number;
  carriedOver: number;
  adjustments: number;
}

// =============================================================================
// Attendance & Scheduling
// =============================================================================

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_LEAVE' | 'ON_LEAVE' | 'HOLIDAY' | 'REST_DAY';

export interface CVisionAttendance extends CVisionBaseRecord {
  employeeId: string;
  date: Date;
  status: AttendanceStatus;
  checkIn?: Date | null;
  checkOut?: Date | null;
  workedHours?: number;
  overtime?: number;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  notes?: string | null;
  source?: string;
  isArchived: boolean;
}

export interface CVisionAttendanceCorrection extends CVisionBaseRecord {
  employeeId: string;
  attendanceId: string;
  date: Date;
  correctionType: string;
  originalValue?: Record<string, any>;
  correctedValue?: Record<string, any>;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string | null;
  approvedAt?: Date | null;
}

export interface CVisionShift extends CVisionBaseRecord {
  name: string;
  nameAr?: string;
  code: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  workingHours: number;
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionShiftTemplate extends CVisionBaseRecord {
  name: string;
  description?: string;
  pattern: Record<string, any>[];
  isActive: boolean;
}

export interface CVisionScheduleEntry extends CVisionBaseRecord {
  employeeId: string;
  shiftId: string;
  date: Date;
  status: string;
  notes?: string | null;
}

export interface CVisionScheduleApproval extends CVisionBaseRecord {
  scheduleId: string;
  status: string;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  notes?: string | null;
}

// =============================================================================
// Training & Development
// =============================================================================

export interface CVisionTrainingCourse extends CVisionBaseRecord {
  title: string;
  titleAr?: string;
  description?: string;
  category: string;
  provider?: string;
  duration?: number;
  durationUnit?: string;
  cost?: number;
  currency?: string;
  maxCapacity?: number;
  startDate?: Date | null;
  endDate?: Date | null;
  location?: string;
  isOnline?: boolean;
  status: string;
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionTrainingEnrollment extends CVisionBaseRecord {
  courseId: string;
  employeeId: string;
  status: string;
  enrolledAt: Date;
  completedAt?: Date | null;
  score?: number | null;
  certificateUrl?: string | null;
  feedback?: string | null;
  isArchived: boolean;
}

export interface CVisionTrainingBudget extends CVisionBaseRecord {
  departmentId: string;
  year: number;
  allocatedAmount: number;
  spentAmount: number;
  currency: string;
  isArchived: boolean;
}

// =============================================================================
// Performance Reviews
// =============================================================================

export interface CVisionReviewCycle extends CVisionBaseRecord {
  name: string;
  year: number;
  startDate: Date;
  endDate: Date;
  status: string;
  isArchived: boolean;
}

export interface CVisionPerformanceReview extends CVisionBaseRecord {
  cycleId: string;
  employeeId: string;
  managerId?: string;
  status: string;
  overallScore?: number;
  overallManagerScore?: number;
  finalScore?: number;
  rating?: string;
  selfReviewJson?: Record<string, any>;
  managerReviewJson?: Record<string, any>;
  goalsJson?: Record<string, any>[];
  submittedAt?: Date | null;
  acknowledgedAt?: Date | null;
  isArchived: boolean;
}

export interface CVisionOkr extends CVisionBaseRecord {
  employeeId: string;
  title: string;
  description?: string;
  period: string;
  status: string;
  progress: number;
  keyResults?: Record<string, any>[];
  isArchived: boolean;
}

export interface CVisionKpi extends CVisionBaseRecord {
  employeeId: string;
  name: string;
  target: number;
  actual: number;
  unit: string;
  period: string;
  isArchived: boolean;
}

// =============================================================================
// Succession & Retention
// =============================================================================

export interface CVisionSuccessionPlan extends CVisionBaseRecord {
  positionId: string;
  positionTitle: string;
  incumbentEmployeeId?: string;
  successors: Array<{
    employeeId: string;
    readiness: string;
    developmentPlan?: string;
  }>;
  status: string;
  isArchived: boolean;
}

export interface CVisionRetentionScore extends CVisionBaseRecord {
  employeeId: string;
  score: number;
  riskLevel: string;
  factors: Record<string, any>;
  calculatedAt: Date;
  isArchived: boolean;
}

export interface CVisionRetentionAlert extends CVisionBaseRecord {
  employeeId: string;
  alertType: string;
  severity: string;
  message: string;
  isResolved: boolean;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
  isArchived: boolean;
}

// =============================================================================
// Notifications & Communications
// =============================================================================

export interface CVisionNotification extends CVisionBaseRecord {
  type: string;
  title: string;
  message: string;
  recipientEmployeeId?: string;
  userId?: string;
  isRead: boolean;
  readAt?: Date | null;
  metadata?: Record<string, any> | null;
}

export interface CVisionNotificationPreference extends CVisionBaseRecord {
  userId: string;
  channel: string;
  eventType: string;
  enabled: boolean;
}

export interface CVisionAnnouncement extends CVisionBaseRecord {
  title: string;
  titleAr?: string;
  content: string;
  contentAr?: string;
  priority: string;
  targetAudience?: string;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionLetter extends CVisionBaseRecord {
  employeeId: string;
  templateId?: string;
  type: string;
  title: string;
  content: string;
  status: string;
  issuedAt?: Date | null;
  issuedBy?: string | null;
  isArchived: boolean;
}

export interface CVisionLetterTemplate extends CVisionBaseRecord {
  name: string;
  nameAr?: string;
  type: string;
  bodyTemplate: string;
  bodyTemplateAr?: string;
  variables?: string[];
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionPolicy extends CVisionBaseRecord {
  title: string;
  titleAr?: string;
  content: string;
  contentAr?: string;
  category: string;
  version: number;
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionPolicyAcknowledgment extends CVisionBaseRecord {
  policyId: string;
  employeeId: string;
  acknowledgedAt: Date;
}

// =============================================================================
// Surveys & Recognition
// =============================================================================

export interface CVisionSurvey extends CVisionBaseRecord {
  title: string;
  description?: string;
  questionsJson: Record<string, any>[];
  status: string;
  startDate?: Date | null;
  endDate?: Date | null;
  isAnonymous: boolean;
  isArchived: boolean;
}

export interface CVisionSurveyResponse extends CVisionBaseRecord {
  surveyId: string;
  employeeId?: string;
  answersJson: Record<string, any>;
  submittedAt: Date;
}

export interface CVisionRecognition extends CVisionBaseRecord {
  fromEmployeeId: string;
  toEmployeeId: string;
  type: string;
  message: string;
  points?: number;
  isArchived: boolean;
}

export interface CVisionRewardPoint extends CVisionBaseRecord {
  employeeId: string;
  points: number;
  reason: string;
  awardedBy: string;
  awardedAt: Date;
}

// =============================================================================
// Travel, Expenses & Assets
// =============================================================================

export interface CVisionTravelRequest extends CVisionBaseRecord {
  employeeId: string;
  destination: string;
  purpose: string;
  startDate: Date;
  endDate: Date;
  estimatedCost: number;
  currency: string;
  status: string;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  isArchived: boolean;
}

export interface CVisionExpenseClaim extends CVisionBaseRecord {
  employeeId: string;
  claimNumber: string;
  totalAmount: number;
  currency: string;
  status: string;
  items: Record<string, any>[];
  submittedAt: Date;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  isArchived: boolean;
}

export interface CVisionAsset extends CVisionBaseRecord {
  assetTag: string;
  name: string;
  category: string;
  assignedTo?: string | null;
  status: string;
  purchaseDate?: Date | null;
  purchasePrice?: number;
  location?: string;
  isArchived: boolean;
}

// =============================================================================
// Grievances & Safety
// =============================================================================

export interface CVisionGrievance extends CVisionBaseRecord {
  employeeId: string;
  grievanceNumber: string;
  type: string;
  description: string;
  status: string;
  priority: string;
  assignedTo?: string | null;
  resolvedAt?: Date | null;
  resolution?: string | null;
  isArchived: boolean;
}

export interface CVisionSafetyIncident extends CVisionBaseRecord {
  reportedBy: string;
  incidentDate: Date;
  location: string;
  type: string;
  severity: string;
  description: string;
  status: string;
  investigationNotes?: string;
  correctiveActions?: string[];
  isArchived: boolean;
}

// =============================================================================
// Transportation
// =============================================================================

export interface CVisionTransportRoute extends CVisionBaseRecord {
  name: string;
  description?: string;
  stops: Record<string, any>[];
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionTransportVehicle extends CVisionBaseRecord {
  plateNumber: string;
  type: string;
  capacity: number;
  driverId?: string | null;
  status: string;
  isArchived: boolean;
}

export interface CVisionTransportAssignment extends CVisionBaseRecord {
  employeeId: string;
  routeId: string;
  vehicleId?: string | null;
  status: string;
  isArchived: boolean;
}

export interface CVisionTransportRequest extends CVisionBaseRecord {
  employeeId: string;
  requestType: string;
  status: string;
  notes?: string;
  isArchived: boolean;
}

export interface CVisionTransportTrip extends CVisionBaseRecord {
  routeId: string;
  vehicleId: string;
  driverId: string;
  date: Date;
  status: string;
  passengers: string[];
  isArchived: boolean;
}

export interface CVisionTransportIssue extends CVisionBaseRecord {
  reportedBy: string;
  type: string;
  description: string;
  status: string;
  resolvedAt?: Date | null;
  isArchived: boolean;
}

// =============================================================================
// Organizational Development
// =============================================================================

export interface CVisionOrgHealthAssessment extends CVisionBaseRecord {
  assessmentDate: Date;
  overallScore: number;
  dimensions: Record<string, any>;
  recommendations?: string[];
  isArchived: boolean;
}

export interface CVisionOrgDesign extends CVisionBaseRecord {
  name: string;
  description?: string;
  status: string;
  designData: Record<string, any>;
  isArchived: boolean;
}

export interface CVisionChangeInitiative extends CVisionBaseRecord {
  name: string;
  description: string;
  status: string;
  startDate?: Date | null;
  endDate?: Date | null;
  ownerId: string;
  impactLevel: string;
  isArchived: boolean;
}

export interface CVisionCultureAssessment extends CVisionBaseRecord {
  assessmentDate: Date;
  scores: Record<string, number>;
  insights?: string[];
  isArchived: boolean;
}

export interface CVisionStrategicAlignment extends CVisionBaseRecord {
  name: string;
  objectiveId?: string;
  status: string;
  alignmentScore: number;
  gapAnalysis?: Record<string, any>;
  isArchived: boolean;
}

export interface CVisionTeam extends CVisionBaseRecord {
  name: string;
  description?: string;
  leaderId: string;
  memberIds: string[];
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionProcessAnalysis extends CVisionBaseRecord {
  processName: string;
  currentState: Record<string, any>;
  proposedState?: Record<string, any>;
  status: string;
  isArchived: boolean;
}

// =============================================================================
// Onboarding & Offboarding
// =============================================================================

export interface CVisionEmployeeOnboarding extends CVisionBaseRecord {
  employeeId: string;
  templateId?: string;
  status: string;
  startDate: Date;
  completedAt?: Date | null;
  tasks: Record<string, any>[];
  isArchived: boolean;
}

export interface CVisionOnboardingTemplate extends CVisionBaseRecord {
  name: string;
  description?: string;
  tasks: Record<string, any>[];
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionOffboarding extends CVisionBaseRecord {
  employeeId: string;
  status: string;
  lastWorkingDay: Date;
  reason: string;
  tasks: Record<string, any>[];
  exitInterviewNotes?: string;
  isArchived: boolean;
}

// =============================================================================
// Branches & Settings
// =============================================================================

export interface CVisionBranch extends CVisionBaseRecord {
  code: string;
  name: string;
  nameAr?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionTenantSettingsCompany {
  name: string;
  nameAr: string;
  logo: string;
  crNumber: string;
  industry: string;
  size: string;
  address: string;
  phone: string;
  email: string;
}

export interface CVisionTenantSettingsBranding {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  darkMode: boolean;
}

export interface CVisionTenantSettingsWorkSchedule {
  workDays: number[];
  restDays: number[];
  defaultStartTime: string;
  defaultEndTime: string;
  defaultWorkingHours: number;
  breakDurationMinutes: number;
  graceMinutes: number;
}

export interface CVisionTenantSettingsPreferences {
  defaultLanguage: string;
  dateFormat: string;
  numberFormat: string;
  calendarType: string;
  timezone: string;
  weekStart: string;
  currency: string;
  fiscalYearStart: number;
}

export interface CVisionTenantSettingsRetention {
  auditLogDays: number;
  deletedRecordsDays: number;
  sessionTimeoutMinutes: number;
  passwordExpiryDays: number;
}

export interface EnabledModule {
  module: string;
  enabled: boolean;
  label: string;
}

export interface CustomField {
  fieldId: string;
  name: string;
  type: string;
  required?: boolean;
  options?: string[];
  order: number;
}

export interface CustomFieldGroup {
  module: string;
  fields: CustomField[];
}

export interface EmailTemplate {
  event: string;
  subject: string;
  body: string;
  enabled: boolean;
}

export interface CVisionTenantSettings extends CVisionBaseRecord {
  company: CVisionTenantSettingsCompany;
  branding: CVisionTenantSettingsBranding;
  enabledModules: EnabledModule[];
  customFields: CustomFieldGroup[];
  customDropdowns: Record<string, any>[];
  emailTemplates: EmailTemplate[];
  workSchedule: CVisionTenantSettingsWorkSchedule;
  preferences: CVisionTenantSettingsPreferences;
  dataRetention: CVisionTenantSettingsRetention;
}

// =============================================================================
// Payroll Ancillary
// =============================================================================

export interface CVisionSalaryStructure extends CVisionBaseRecord {
  name: string;
  gradeId?: string;
  components: Record<string, any>[];
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionEmployeeCompensation extends CVisionBaseRecord {
  employeeId: string;
  effectiveDate: Date;
  basicSalary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  totalPackage: number;
  currency: string;
  isArchived: boolean;
}

export interface CVisionJournalEntry extends CVisionBaseRecord {
  runId?: string;
  entryNumber: string;
  date: Date;
  description: string;
  lines: Record<string, any>[];
  status: string;
  isArchived: boolean;
}

export interface CVisionGlMapping extends CVisionBaseRecord {
  code: string;
  name: string;
  accountNumber: string;
  category: string;
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionHeadcountBudget extends CVisionBaseRecord {
  departmentId: string;
  year: number;
  budgetedHeadcount: number;
  actualHeadcount: number;
  variance: number;
  notes?: string;
  isArchived: boolean;
}

export interface CVisionDepartmentBudget extends CVisionBaseRecord {
  departmentId: string;
  year: number;
  allocatedAmount: number;
  spentAmount: number;
  currency: string;
  categories: Record<string, number>;
  isArchived: boolean;
}

// =============================================================================
// Dashboards & Reports
// =============================================================================

export interface CVisionDashboard extends CVisionBaseRecord {
  name: string;
  description?: string;
  layout: Record<string, any>;
  widgets: Record<string, any>[];
  isDefault: boolean;
  ownerId: string;
  isArchived: boolean;
}

export interface CVisionSavedReport extends CVisionBaseRecord {
  name: string;
  description?: string;
  reportType: string;
  filtersJson: Record<string, any>;
  columnsJson: string[];
  ownerId: string;
  isShared: boolean;
  isArchived: boolean;
}

// =============================================================================
// Workflows & Delegation
// =============================================================================

export interface CVisionWorkflow extends CVisionBaseRecord {
  name: string;
  type: string;
  steps: Record<string, any>[];
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionWorkflowInstance extends CVisionBaseRecord {
  workflowId: string;
  resourceType: string;
  resourceId: string;
  currentStep: number;
  status: string;
  stepsCompleted: Record<string, any>[];
  isArchived: boolean;
}

export interface CVisionApprovalMatrix extends CVisionBaseRecord {
  resourceType: string;
  conditions: Record<string, any>;
  approvers: Array<{
    userId: string;
    role: string;
    order: number;
  }>;
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionDelegation extends CVisionBaseRecord {
  fromUserId: string;
  toUserId: string;
  permissions: string[];
  startDate: Date;
  endDate: Date;
  reason?: string;
  isActive: boolean;
}

// =============================================================================
// Auth Events & Integration
// =============================================================================

export interface CVisionAuthEvent extends CVisionBaseRecord {
  userId: string;
  eventType: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface CVisionIntegrationConfig extends CVisionBaseRecord {
  name: string;
  type: string;
  configJson: Record<string, any>;
  isActive: boolean;
  lastSyncAt?: Date | null;
  isArchived: boolean;
}

export interface CVisionIntegrationLog extends CVisionBaseRecord {
  integrationId: string;
  action: string;
  status: string;
  requestPayload?: Record<string, any>;
  responsePayload?: Record<string, any>;
  errorMessage?: string;
}

// =============================================================================
// Miscellaneous
// =============================================================================

export interface CVisionSequence extends CVisionBaseRecord {
  prefix: string;
  currentValue: number;
}

export interface CVisionImportJob extends CVisionBaseRecord {
  type: string;
  fileName: string;
  status: string;
  totalRows: number;
  processedRows: number;
  errors: Record<string, any>[];
  startedAt: Date;
  completedAt?: Date | null;
  isArchived: boolean;
}

export interface CVisionDeletedRecord extends CVisionBaseRecord {
  originalCollection: string;
  originalId: string;
  originalData: Record<string, any>;
  deletedByUserId: string;
  restoredAt?: Date | null;
  restoredBy?: string | null;
}

export interface CVisionCalendarEvent extends CVisionBaseRecord {
  title: string;
  titleAr?: string;
  date: Date;
  endDate?: Date | null;
  type: string;
  isRecurring: boolean;
  isArchived: boolean;
}

export interface CVisionEmployeeDocument extends CVisionBaseRecord {
  employeeId: string;
  documentType: string;
  fileName: string;
  storageKey: string;
  mimeType?: string;
  fileSize?: number;
  expiryDate?: Date | null;
  isArchived: boolean;
}

export interface CVisionBiometricLog extends CVisionBaseRecord {
  employeeId: string;
  deviceId: string;
  timestamp: Date;
  eventType: string;
  rawData?: Record<string, any>;
}

export interface CVisionGeofence extends CVisionBaseRecord {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  isArchived: boolean;
}

export interface CVisionEmployeeShiftPreference extends CVisionBaseRecord {
  employeeId: string;
  preferredShiftIds: string[];
  unavailableDates?: string[];
  notes?: string;
}

export interface CVisionDepartmentWorkSchedule extends CVisionBaseRecord {
  departmentId: string;
  schedulePattern: Record<string, any>;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive: boolean;
}

export interface CVisionPayrollDryRun extends CVisionBaseRecord {
  runId: string;
  period: string;
  results: Record<string, any>;
  isArchived: boolean;
}

export interface CVisionLoanPolicy extends CVisionBaseRecord {
  name: string;
  maxAmount: number;
  maxTermMonths: number;
  interestRate: number;
  eligibilityCriteria: Record<string, any>;
  isActive: boolean;
  isArchived: boolean;
}

// =============================================================================
// Recruitment Additional
// =============================================================================

export interface CVisionInterview extends CVisionBaseRecord {
  candidateId: string;
  requisitionId?: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduledDate: Date;
  scheduledTime: string;
  duration?: number;
  location?: string;
  meetingLink?: string;
  interviewers: string[];
  score?: number;
  feedback?: string;
  decision?: InterviewDecision;
  completedAt?: Date | null;
  isArchived: boolean;
}

export interface CVisionInterviewSession extends CVisionBaseRecord {
  interviewId: string;
  candidateId: string;
  sessionType: string;
  status: string;
  startedAt?: Date | null;
  endedAt?: Date | null;
  notes?: string;
  aiAnalysis?: Record<string, any>;
  isArchived: boolean;
}

export interface CVisionTalentPool extends CVisionBaseRecord {
  candidateId: string;
  pool: string;
  addedBy: string;
  addedAt: Date;
  notes?: string;
  isArchived: boolean;
}

export interface CVisionCandidateRanking extends CVisionBaseRecord {
  candidateId: string;
  requisitionId: string;
  score: number;
  factors: Record<string, any>;
  rankedAt: Date;
}

// =============================================================================
// AI Thresholds (used by AI engines)
// =============================================================================

export interface CVisionAiThreshold extends CVisionBaseRecord {
  modelName: string;
  thresholdType: string;
  value: number;
  metadata?: Record<string, any>;
  isActive: boolean;
}

export interface CVisionReviewQueue extends CVisionBaseRecord {
  resourceType: string;
  resourceId: string;
  reviewType: string;
  status: string;
  assignedTo?: string;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  notes?: string;
  isArchived: boolean;
}

export interface CVisionDecisionOutcome extends CVisionBaseRecord {
  decisionType: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  confidence: number;
  factors: Record<string, any>;
  isArchived: boolean;
}

// =============================================================================
// IPD Episode Types
// =============================================================================

export interface IPDPatient {
  id?: string;
  patientMasterId?: string;
  fullName?: string;
  mrn?: string;
  tempMrn?: string;
  allergies?: string[];
  [key: string]: unknown;
}

export interface IPDEpisodeLocation {
  ward?: string;
  unit?: string;
  room?: string;
  bed?: string;
  [key: string]: unknown;
}

export interface IPDEpisodeOwnership {
  attendingPhysicianUserId?: string;
  primaryInpatientNurseUserId?: string;
  [key: string]: unknown;
}

export interface IPDEpisodeSource {
  handoffId?: string;
  [key: string]: unknown;
}

export interface IPDNursingSummary {
  situation?: string;
  background?: string;
  assessment?: string;
  recommendation?: string;
}

export interface IPDDoctorSummary {
  content?: string;
}

export interface IPDRiskFlags {
  [key: string]: unknown;
}

export interface IPDPendingItem {
  id?: string;
  label?: string;
  kind?: string;
  status?: string;
  [key: string]: unknown;
}

export interface IPDEpisode {
  id?: string;
  encounterId?: string;
  patient?: IPDPatient;
  location?: IPDEpisodeLocation;
  ownership?: IPDEpisodeOwnership;
  source?: IPDEpisodeSource;
  allergies?: string[];
  reasonForAdmission?: string;
  admissionNotes?: string;
  doctorSummary?: IPDDoctorSummary;
  nursingSummary?: IPDNursingSummary;
  pendingTasks?: IPDPendingItem[];
  pendingResults?: IPDPendingItem[];
  riskFlags?: IPDRiskFlags;
  createdAt?: string;
  [key: string]: unknown;
}

export interface IPDEpisodeResponse {
  episode?: IPDEpisode;
  error?: string;
  [key: string]: unknown;
}

export interface IPDItemsResponse<T = Record<string, any>> {
  items?: T[];
  [key: string]: unknown;
}

export interface IPDMarResponse {
  due?: Record<string, any>[];
  prn?: Record<string, any>[];
  history?: Record<string, any>[];
  [key: string]: unknown;
}

export interface IPDMedReconRecord {
  type?: string;
  completedAt?: string;
  items?: unknown[];
  [key: string]: unknown;
}

export interface IPDMedCatalogItem {
  id: string;
  genericName?: string;
  strength?: string;
  form?: string;
  code?: string;
  routes?: string[];
  [key: string]: unknown;
}

export interface IPDCachedSnapshot {
  episodeData?: IPDEpisodeResponse;
  usersData?: IPDItemsResponse;
  ordersData?: IPDItemsResponse;
  vitalsData?: IPDItemsResponse;
  connectVitalsData?: IPDItemsResponse;
  notesData?: IPDItemsResponse;
  assessmentsData?: IPDItemsResponse;
  todayResultsData?: IPDItemsResponse;
  tasksQueueData?: IPDItemsResponse;
  medOrdersData?: IPDItemsResponse;
  pharmacyQueueData?: IPDItemsResponse;
  carePlansData?: IPDItemsResponse;
  doctorProgressData?: IPDItemsResponse;
  nursingProgressData?: IPDItemsResponse;
  marData?: IPDMarResponse;
  narcoticCountData?: IPDItemsResponse;
  medTimelineData?: IPDItemsResponse;
  homeMedsData?: IPDItemsResponse;
  medReconData?: IPDItemsResponse;
  updatedAt?: string;
  [key: string]: unknown;
}

// =============================================================================
// ER (Emergency Room) Types
// =============================================================================

export interface ErPatientInfo {
  fullName?: string;
  mrn?: string;
  tempMrn?: string;
  patientMasterId?: string;
}

export interface ErBedInfo {
  zone?: string;
  bedLabel?: string;
}

export interface ErTriageInfo {
  critical?: boolean;
  notes?: string;
  createdAt?: string;
  vitals?: Record<string, unknown>;
}

export interface ErIdentityVerification {
  matchLevel?: string;
}

export interface ErPatientMasterInfo {
  identityVerification?: ErIdentityVerification;
}

export interface ErStaffAssignment {
  role: string;
  userId?: string;
  displayName?: string;
}

export interface ErNotesContent {
  content?: string;
}

export interface ErDisposition {
  type?: 'DISCHARGE' | 'ADMIT' | 'TRANSFER';
  finalDiagnosis?: string;
  dischargeInstructions?: string;
  followUpPlan?: string;
  dischargeMedications?: string;
  sickLeaveRequested?: boolean;
  admitService?: string;
  admitWardUnit?: string;
  acceptingPhysician?: string;
  reasonForAdmission?: string;
  handoffSbar?: string;
  bedRequestCreatedAt?: string;
  transferType?: string;
  destinationFacilityUnit?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface ErEncounterData {
  id?: string;
  encounterCoreId?: string;
  visitNumber?: string;
  status?: string;
  statusUpdatedAt?: string;
  chiefComplaint?: string;
  triageLevel?: string;
  arrivalTime?: string;
  createdAt?: string;
  updatedAt?: string;
  seenByDoctorUserId?: string;
  patient?: ErPatientInfo;
  patientMaster?: ErPatientMasterInfo;
  bed?: ErBedInfo;
  triage?: ErTriageInfo;
  staffAssignments?: ErStaffAssignment[];
  notes?: ErNotesContent;
  disposition?: ErDisposition | null;
}

export interface ErTimelineEntry {
  id?: string;
  action?: string;
  entityType?: string;
  timestamp?: string;
  createdAt?: string;
  userId?: string;
}

/** Generic paginated list response from ER API endpoints */
export interface ErListResponse<T = Record<string, unknown>> {
  items?: T[];
}

export interface ErAdmitUnit {
  id: string;
  name: string;
  shortCode?: string;
}

export interface ErAdmitRoom {
  id: string;
  name: string;
}

export interface ErAdmitOptionsResponse {
  units?: ErAdmitUnit[];
  rooms?: ErAdmitRoom[];
}

export interface ErAcceptingPhysician {
  id: string;
  displayName?: string;
}

export interface ErOrderTask {
  id?: string;
  orderId?: string;
  orderSetKey?: string;
  label?: string;
  taskName?: string;
  status?: string;
  startedAt?: string;
  completedAt?: string;
  resultAcknowledgedAt?: string;
  orderName?: string;
  orderCode?: string;
  kind?: string;
}

export interface ErResultItem {
  id: string;
  summary?: string;
  resultType?: string;
  status?: string;
  createdAt?: string;
  acksCount?: number;
  ackedByMe?: boolean;
}

export interface ErResultsResponse extends ErListResponse<ErResultItem> {
  pendingReviewCount?: number;
}

export interface ErAttachmentItem {
  id: string;
  fileName?: string;
  mimeType?: string;
}

export interface ErNursingNote {
  id: string;
  type?: string;
  content?: string;
  createdAt?: string;
  createdByName?: string;
}

export interface ErDoctorNote {
  id: string;
  type?: string;
  content?: string;
  createdAt?: string;
  createdByName?: string;
}

export interface ErClinicalNote {
  id: string;
  title?: string;
  content?: string;
  noteType?: string;
  createdAt?: string;
  createdByName?: string;
}

export interface ErHandover {
  id: string;
  type?: string;
  situation?: string;
  background?: string;
  assessment?: string;
  recommendation?: string;
  createdAt?: string;
  createdByName?: string;
}

export interface ErTransferRequest {
  id: string;
  status?: string;
  reason?: string;
  urgency?: string;
  createdAt?: string;
  requestedByDisplay?: string;
}

export interface ErEscalation {
  id: string;
  status?: string;
  reason?: string;
  urgency?: string;
  note?: string;
  createdAt?: string;
}

export interface ErEscalationsResponse extends ErListResponse<ErEscalation> {
  hasOpenEscalation?: boolean;
}

export interface ErNursingUser {
  id: string;
  displayName?: string;
}

export interface ErDischargeRecord {
  id?: string;
  disposition?: string;
  summaryText?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ErDischargeData {
  discharge?: ErDischargeRecord | null;
}

export interface ErDeathDeclaration {
  id?: string;
  declaredAt?: string;
  finalizedAt?: string;
  placeOfDeath?: string;
  preliminaryCause?: string;
  [key: string]: unknown;
}

export interface ErMortuaryCase {
  id?: string;
  [key: string]: unknown;
}

export interface ErDeathStatusData {
  declaration?: ErDeathDeclaration | null;
  mortuaryCase?: ErMortuaryCase | null;
}

export interface ErIpdEpisodeData {
  episode?: { id?: string } | null;
}

// ── Analytics Dashboard Types ──────────────────────────────────────────────

export interface AnalyticsOpdTrendItem {
  date: string;
  total: number;
  completed: number;
}

export interface AnalyticsKpiItem {
  id: string;
  name: string;
  category: string;
  value: number | null;
  target: number | null;
  unit?: string;
  status: 'green' | 'yellow' | 'red' | 'gray';
  trend: 'improving' | 'declining' | 'stable';
}

export interface AnalyticsDepartmentCount {
  department: string;
  count: number;
}

export interface AnalyticsHourlyItem {
  hour: number;
  count: number;
}

export interface AnalyticsDepartmentRevenue {
  department: string;
  revenue?: number;
  amount?: number;
}

export interface AnalyticsRegistryItem {
  name: string;
  count: number;
  controlRate?: number | null;
}

export interface AnalyticsCareGapItem {
  gapType: string;
  count: number;
}

export interface AnalyticsAbxDrugItem {
  drug: string;
  count: number;
  ddd?: number | null;
}

export interface AnalyticsAbxAlert {
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export interface AnalyticsAbxMonthlyItem {
  month: string;
  totalDDD: number;
}

export interface AnalyticsInfectionTypeItem {
  type: string;
  count: number;
}

export interface AnalyticsOrganismItem {
  organism: string;
  count: number;
}

export interface AnalyticsInfectionAlert {
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export interface AnalyticsInfectionMonthlyItem {
  month: string;
  count: number;
}

export interface AnalyticsExecDepartmentItem {
  departmentId: string;
  name: string;
  count: number;
}

export interface AnalyticsPeakHour {
  hour: number;
  label: string;
  count: number;
}

export interface AnalyticsPeakDay {
  dayName: string;
  avgCount: number;
}

export interface AnalyticsPeakMonth {
  monthName: string;
  avgCount: number;
}

export interface AnalyticsRankingItem {
  doctorId: string;
  name: string;
  count?: number;
  pct?: number;
  [key: string]: string | number | undefined;
}

export interface AnalyticsDoctorPerf {
  doctorId: string;
  name: string;
  specialty: string;
  metrics?: {
    totalPatients?: number;
    completionRate?: number;
  };
  utilization?: {
    target?: number;
    utilizationPct?: number;
    avgDaily?: number;
    censusSharePct?: number;
  };
  productivity?: {
    documentationPct?: number;
  };
}

export interface AnalyticsDqDepartment {
  departmentId: string;
  name: string;
  score: number;
  encounters: number;
  missingVitalsPct: number;
  missingNotesPct: number;
  missingDiagnosisPct: number;
  avgWaitMinutes: number;
}

export interface AnalyticsDqDoctor {
  doctorId: string;
  name: string;
  encounters: number;
  documentationPct: number;
}

// =============================================================================
// AI Engine Types — structured shapes for skills, requirements, salary, etc.
// =============================================================================

/** Structured skills object on a job requisition (required + preferred). */
export interface JobSkillsStructured {
  required: string[];
  preferred: string[];
}

/** Experience years range on a job requisition. */
export interface ExperienceYearsRange {
  min: number;
  max?: number;
}

/** Salary range on a job requisition. */
export interface SalaryRange {
  min: number;
  max: number;
  currency?: string;
}

/** Requirements structure stored on a job requisition. */
export interface JobRequirementsRecord {
  education?: string;
  location?: string;
  [key: string]: unknown;
}

/** Candidate metadata shape (from CV parse or manual entry). */
export interface CandidateMetadata {
  skills?: string[];
  yearsOfExperience?: number | string;
  experience?: CandidateExperienceEntry[];
  education?: CandidateEducationEntry[];
  coverLetter?: string;
  references?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/** Single experience entry extracted from a parsed CV. */
export interface CandidateExperienceEntry {
  title?: string;
  company?: string;
  years?: number;
  duration?: string;
}

/** Single education entry extracted from a parsed CV. */
export interface CandidateEducationEntry {
  degree?: string;
  field?: string;
  institution?: string;
}

/** Extracted JSON shape from a CV parse job. */
export interface CvParseExtractedJson {
  skills?: string[];
  experience?: CandidateExperienceEntry[];
  education?: CandidateEducationEntry[];
  yearsOfExperience?: number | string;
  [key: string]: unknown;
}

/** A MongoDB-stored department (minimal shape used in AI engines). */
export interface CVisionDepartmentRecord {
  id: string;
  tenantId: string;
  name: string;
  [key: string]: unknown;
}

/** A MongoDB-stored CV parse job record. */
export interface CVisionCvParseJobRecord {
  tenantId: string;
  candidateId: string;
  extractedJson?: CvParseExtractedJson | null;
  metaJson?: CvParseExtractedJson | null;
  extractedRawText?: string | null;
  extractedText?: string | null;
  [key: string]: unknown;
}

/** Interview session update fields (for MongoDB $set). */
export interface InterviewSessionUpdateFields {
  updatedAt: Date;
  currentQuestionIndex: number;
  status?: string;
  startedAt?: Date;
}

// =============================================================================
// Loan Engine — MongoDB Document Types
// =============================================================================

import type { LoanType, LoanApproval, Installment } from '@/lib/cvision/loans/loans-engine';

/** Shape of a loan document stored in the cvision_loans collection. */
export interface LoanDocument {
  _id?: unknown;
  tenantId: string;
  loanId: string;
  employeeId: string;
  employeeName: string;
  type: LoanType;
  requestedAmount: number;
  approvedAmount: number;
  currency: 'SAR';
  repaymentMethod: 'SALARY_DEDUCTION';
  installments: number;
  installmentAmount: number;
  interestRate: number;
  totalRepayment: number;
  installmentSchedule: Installment[];
  totalPaid: number;
  remainingBalance: number;
  remaining?: number;
  requestDate: Date;
  firstInstallmentDate: Date;
  expectedCompletionDate: Date;
  actualCompletionDate?: Date;
  disbursementDate?: Date;
  approvalDate?: Date;
  status: LoanStatus;
  approvals: LoanApproval[];
  reason: string;
  guarantor?: LoanGuarantor;
  monthlyDeduction?: number;
  principal?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanGuarantor {
  employeeId: string;
  employeeName: string;
  acknowledged: boolean;
}

// =============================================================================
// Warehouse Engine — MongoDB Document Shapes
// =============================================================================

/** A raw employee document from the cvision_employees collection. */
export interface WarehouseEmployeeDoc {
  _id?: unknown;
  id: string;
  tenantId: string;
  status: string;
  departmentId?: string;
  nationality?: string;
  gender?: string;
  hiredAt?: string | Date;
  dateOfBirth?: string | Date;
  terminatedAt?: string | Date;
  resignedAt?: string | Date;
  fullName?: string;
  name?: string;
  salary?: number;
  basicSalary?: number;
  isArchived?: boolean;
  deletedAt?: Date;
  [key: string]: unknown;
}

/** A raw department document from the cvision_departments collection. */
export interface WarehouseDepartmentDoc {
  _id?: unknown;
  id: string;
  name?: string;
  tenantId: string;
  [key: string]: unknown;
}

/** A raw contract document from the cvision_contracts collection. */
export interface WarehouseContractDoc {
  _id?: unknown;
  id?: string;
  tenantId: string;
  employeeId: string;
  basicSalary?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  [key: string]: unknown;
}

/** A raw performance review document. */
export interface WarehouseReviewDoc {
  _id?: unknown;
  id?: string;
  tenantId: string;
  status?: string;
  completedAt?: string | Date;
  finalScore?: number | null;
  rating?: string;
  [key: string]: unknown;
}

/** A raw leave document. */
export interface WarehouseLeaveDoc {
  _id?: unknown;
  tenantId: string;
  leaveType?: string;
  type?: string;
  days?: number;
  totalDays?: number;
  startDate?: string;
  endDate?: string;
  createdAt?: Date;
  [key: string]: unknown;
}

/** A raw job requisition document. */
export interface WarehouseRequisitionDoc {
  _id?: unknown;
  id?: string;
  tenantId: string;
  status?: string;
  headcount?: number;
  updatedAt?: Date;
  isArchived?: boolean;
  [key: string]: unknown;
}

/** A raw candidate document. */
export interface WarehouseCandidateDoc {
  _id?: unknown;
  tenantId: string;
  status?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  [key: string]: unknown;
}

/** A raw retention score document. */
export interface WarehouseRetentionScoreDoc {
  _id?: unknown;
  tenantId: string;
  flightRiskScore?: number;
  riskLevel?: string;
  [key: string]: unknown;
}

/** A raw snapshot document from cvision_data_snapshots. */
export interface WarehouseSnapshotDoc {
  _id?: unknown;
  tenantId: string;
  period?: string;
  snapshotId?: string;
  [key: string]: unknown;
}

/** A raw ETL log document from cvision_etl_logs. */
export interface WarehouseETLLogDoc {
  _id?: unknown;
  tenantId: string;
  pipelineId: string;
  success: boolean;
  documentsProcessed: number;
  duration: number;
  error?: string | null;
  ranAt: Date;
}

// =============================================================================
// CDO Module — Prisma Client Extension Types
// =============================================================================

/**
 * Typed interface for CDO-related Prisma model delegates.
 * These models may not yet exist in the generated Prisma client,
 * so we define the delegate shape here for type safety.
 */
export interface PrismaModelDelegate {
  create?: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  findFirst?: (args: { where: Record<string, unknown> }) => Promise<unknown | null>;
  findMany?: (args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown> | Record<string, unknown>[];
  }) => Promise<unknown[]>;
  update?: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<unknown>;
  count: (args: { where?: Record<string, unknown> }) => Promise<number>;
  aggregate: (args: {
    where?: Record<string, unknown>;
    _avg?: Record<string, boolean>;
    _count?: Record<string, boolean>;
  }) => Promise<Record<string, unknown>>;
  groupBy: (args: {
    by: string[];
    where?: Record<string, unknown>;
    _count?: Record<string, boolean>;
  }) => Promise<Array<Record<string, unknown>>>;
}

/** Prisma client augmented with CDO model delegates. */
export interface CDOPrismaClient {
  clinicalDecisionPrompt?: PrismaModelDelegate;
  cdoRiskFlag?: PrismaModelDelegate;
  cdoOutcomeEvent?: PrismaModelDelegate;
  cdoResponseTimeMetric?: PrismaModelDelegate;
  cdoTransitionOutcome?: PrismaModelDelegate;
  cdoReadmissionEvent?: PrismaModelDelegate;
  cdoQualityIndicator?: PrismaModelDelegate;
}
