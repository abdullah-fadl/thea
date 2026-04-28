/**
 * CVision Prisma Helpers
 *
 * Provides type-safe Prisma model access for CVision, replacing the
 * MongoDB-compatible PrismaShim layer.
 *
 * Usage:
 *   import { cvisionModel } from '@/lib/cvision/prisma-helpers';
 *   const employees = await cvisionModel('employees').findMany({ where: { tenantId } });
 */

import { prisma } from '@/lib/db/prisma';
import type { Prisma, PrismaClient } from '@prisma/client';

// ─── Collection Name → Prisma Delegate Mapping ───────────────────────────────
// Maps CVISION_COLLECTIONS keys to the corresponding Prisma model delegate.
// The delegate name is the camelCase version of the Prisma model name.

type PrismaDelegate = {
  findMany: (args?: any) => Promise<any[]>;
  findFirst: (args?: any) => Promise<any | null>;
  findUnique: (args?: any) => Promise<any | null>;
  create: (args: any) => Promise<any>;
  createMany: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  updateMany: (args: any) => Promise<any>;
  upsert: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  deleteMany: (args: any) => Promise<any>;
  count: (args?: any) => Promise<number>;
  aggregate: (args: any) => Promise<any>;
  groupBy: (args: any) => Promise<any[]>;
};

const COLLECTION_TO_PRISMA: Record<string, keyof PrismaClient> = {
  // ── Core HR ─────────────────────────────────────────────────────────
  cvision_departments: 'cvisionDepartment',
  cvision_units: 'cvisionUnit',
  cvision_job_titles: 'cvisionJobTitle',
  cvision_grades: 'cvisionGrade',
  cvision_branches: 'cvisionBranch',
  cvision_employees: 'cvisionEmployee',
  cvision_employee_status_history: 'cvisionEmployeeStatusHistory',
  cvision_contracts: 'cvisionContract',
  cvision_budgeted_positions: 'cvisionBudgetedPosition',
  cvision_position_slots: 'cvisionPositionSlot',
  cvision_employee_documents: 'cvisionEmployeeDocument',

  // ── Insurance ───────────────────────────────────────────────────────
  cvision_insurance_providers: 'cvisionInsuranceProvider',
  cvision_insurance_policies: 'cvisionInsurancePolicy',
  cvision_employee_insurances: 'cvisionEmployeeInsurance',
  cvision_insurance_claims: 'cvisionInsuranceClaim',
  cvision_insurance_requests: 'cvisionInsuranceRequest',

  // ── Requests & Workflows ────────────────────────────────────────────
  cvision_requests: 'cvisionRequest',
  cvision_request_events: 'cvisionRequestEvent',
  cvision_workflows: 'cvisionWorkflow',
  cvision_workflow_instances: 'cvisionWorkflowInstance',
  cvision_approval_matrix: 'cvisionApprovalMatrix',
  cvision_delegations: 'cvisionDelegation',

  // ── Notifications & Communication ───────────────────────────────────
  cvision_notifications: 'cvisionNotification',
  cvision_notification_preferences: 'cvisionNotificationPreference',
  cvision_announcements: 'cvisionAnnouncement',
  cvision_letters: 'cvisionLetter',
  cvision_letter_templates: 'cvisionLetterTemplate',
  cvision_policies: 'cvisionPolicy',
  cvision_policy_acknowledgments: 'cvisionPolicyAcknowledgment',

  // ── Audit & Auth ────────────────────────────────────────────────────
  cvision_audit_logs: 'cvisionAuditLog',
  cvision_auth_events: 'cvisionAuthEvent',
  cvision_tenant_settings: 'cvisionTenantSettings',
  cvision_sequences: 'cvisionSequence',
  cvision_import_jobs: 'cvisionImportJob',
  cvision_deleted_records: 'cvisionDeletedRecord',
  cvision_saved_reports: 'cvisionSavedReport',
  cvision_calendar_events: 'cvisionCalendarEvent',

  // ── Scheduling & Attendance ─────────────────────────────────────────
  cvision_shifts: 'cvisionShift',
  cvision_shift_templates: 'cvisionShiftTemplate',
  cvision_shift_assignments: 'cvisionShiftAssignment',
  cvision_attendance: 'cvisionAttendance',
  cvision_attendance_corrections: 'cvisionAttendanceCorrection',
  cvision_biometric_logs: 'cvisionBiometricLog',
  cvision_schedule_entries: 'cvisionScheduleEntry',
  cvision_schedule_approvals: 'cvisionScheduleApproval',
  cvision_employee_shift_preferences: 'cvisionEmployeeShiftPreference',
  cvision_department_work_schedules: 'cvisionDepartmentWorkSchedule',
  cvision_geofences: 'cvisionGeofence',

  // ── Leaves ──────────────────────────────────────────────────────────
  cvision_leaves: 'cvisionLeave',
  cvision_leave_balances: 'cvisionLeaveBalance',

  // ── Payroll & Compensation ──────────────────────────────────────────
  cvision_payroll_profiles: 'cvisionPayrollProfile',
  cvision_payroll_runs: 'cvisionPayrollRun',
  cvision_payslips: 'cvisionPayslip',
  cvision_payroll_exports: 'cvisionPayrollExport',
  cvision_payroll_dry_runs: 'cvisionPayrollDryRun',
  cvision_loans: 'cvisionLoan',
  cvision_loan_policies: 'cvisionLoanPolicy',
  cvision_salary_structures: 'cvisionSalaryStructure',
  cvision_employee_compensations: 'cvisionEmployeeCompensation',
  cvision_journal_entries: 'cvisionJournalEntry',
  cvision_gl_mappings: 'cvisionGlMapping',
  cvision_department_budgets: 'cvisionDepartmentBudget',
  cvision_headcount_budgets: 'cvisionHeadcountBudget',

  // ── Performance & Development ───────────────────────────────────────
  cvision_performance_reviews: 'cvisionPerformanceReview',
  cvision_review_cycles: 'cvisionReviewCycle',
  cvision_okrs: 'cvisionOkr',
  cvision_kpis: 'cvisionKpi',
  cvision_disciplinary_actions: 'cvisionDisciplinary',
  cvision_promotions: 'cvisionPromotion',
  cvision_training_courses: 'cvisionTrainingCourse',
  cvision_training_enrollments: 'cvisionTrainingEnrollment',
  cvision_training_budgets: 'cvisionTrainingBudget',
  cvision_succession_plans: 'cvisionSuccessionPlan',

  // ── Onboarding & Offboarding ────────────────────────────────────────
  cvision_employee_onboardings: 'cvisionEmployeeOnboarding',
  cvision_onboarding_templates: 'cvisionOnboardingTemplate',
  cvision_offboardings: 'cvisionOffboarding',

  // ── Profile Sections ────────────────────────────────────────────────
  cvision_employee_profile_sections: 'cvisionEmployeeProfileSection',
  cvision_employee_profile_section_history: 'cvisionEmployeeProfileSectionHistory',
  cvision_profile_section_schemas: 'cvisionProfileSectionSchema',

  // ── Recognition & Rewards ───────────────────────────────────────────
  cvision_recognitions: 'cvisionRecognition',
  cvision_reward_points: 'cvisionRewardPoint',
  cvision_surveys: 'cvisionSurvey',
  cvision_survey_responses: 'cvisionSurveyResponse',

  // ── Organizational Development ──────────────────────────────────────
  cvision_org_health_assessments: 'cvisionOrgHealthAssessment',
  cvision_org_designs: 'cvisionOrgDesign',
  cvision_change_initiatives: 'cvisionChangeInitiative',
  cvision_culture_assessments: 'cvisionCultureAssessment',
  cvision_strategic_alignment: 'cvisionStrategicAlignment',
  cvision_teams: 'cvisionTeam',
  cvision_process_analysis: 'cvisionProcessAnalysis' as keyof PrismaClient,

  // ── Muqeem & Integration ────────────────────────────────────────────
  cvision_muqeem_records: 'cvisionMuqeemRecord',
  cvision_muqeem_alerts: 'cvisionMuqeemAlert',
  cvision_integration_configs: 'cvisionIntegrationConfig',
  cvision_integration_logs: 'cvisionIntegrationLog',
  cvision_integrations: 'cvisionIntegrationConfig',

  // ── Retention ───────────────────────────────────────────────────────
  cvision_retention_scores: 'cvisionRetentionScore',
  cvision_retention_alerts: 'cvisionRetentionAlert',
  cvision_dashboards: 'cvisionDashboard',

  // ── Travel & Expenses ───────────────────────────────────────────────
  cvision_travel_requests: 'cvisionTravelRequest',
  cvision_expense_claims: 'cvisionExpenseClaim',
  cvision_assets: 'cvisionAsset',
  cvision_grievances: 'cvisionGrievance',
  cvision_safety_incidents: 'cvisionSafetyIncident',

  // ── Transportation ──────────────────────────────────────────────────
  cvision_transport_routes: 'cvisionTransportRoute',
  cvision_transport_vehicles: 'cvisionTransportVehicle',
  cvision_transport_assignments: 'cvisionTransportAssignment',
  cvision_transport_requests: 'cvisionTransportRequest',
  cvision_transport_trips: 'cvisionTransportTrip',
  cvision_transport_issues: 'cvisionTransportIssue',

  // ── Recruitment ─────────────────────────────────────────────────────
  cvision_job_requisitions: 'cvisionJobRequisition',
  cvision_candidates: 'cvisionCandidate',
  cvision_candidate_documents: 'cvisionCandidateDocument',
  cvision_interviews: 'cvisionInterview',
  cvision_interview_sessions: 'cvisionInterviewSession',
  cvision_job_postings: 'cvisionJobPosting',
  cvision_applications: 'cvisionApplication',
  cvision_cv_parse_jobs: 'cvisionCvParseJob',
  cvision_cv_inbox_batches: 'cvisionCvInboxBatch',
  cvision_cv_inbox_items: 'cvisionCvInboxItem',
  cvision_talent_pool: 'cvisionTalentPool',
  cvision_killout_questions: 'cvisionKilloutQuestion',
  cvision_candidate_rankings: 'cvisionCandidateRanking',
  cvision_manpower_plans: 'cvisionManpowerPlan',

  // ── AI ──────────────────────────────────────────────────────────────
  cvision_ai_thresholds: 'cvisionAiThreshold' as keyof PrismaClient,
  cvision_review_queue: 'cvisionReviewQueue' as keyof PrismaClient,
  cvision_decision_outcomes: 'cvisionDecisionOutcome' as keyof PrismaClient,

  // ── Platform tables (non-CVision but used by platformDb) ────────────
  users: 'user',
  tenants: 'tenant',
  cvision_tenants: 'tenant',

  // ── Misc (aliases / legacy names) ───────────────────────────────────
  cvision_positions: 'cvisionBudgetedPosition',
  cvision_salary_structure: 'cvisionSalaryStructure',
  cvision_employee_compensation: 'cvisionEmployeeCompensation',
  cvision_company_policies: 'cvisionPolicy',
  cvision_notification_center: 'cvisionNotification',
  cvision_disciplinary: 'cvisionDisciplinary',
  cvision_onboarding_processes: 'cvisionEmployeeOnboarding',
  cvision_onboarding_instances: 'cvisionEmployeeOnboarding',
  cvision_headcount_budget: 'cvisionHeadcountBudget',
  cvision_position_requests: 'cvisionRequest',
  cvision_assignments: 'cvisionShiftAssignment',
  cvision_undo_stack: 'cvisionDeletedRecord',
  cvision_expenses: 'cvisionExpenseClaim',
};

/**
 * Get the Prisma model delegate for a CVision collection name.
 *
 * @example
 *   const model = cvisionModel('cvision_employees');
 *   const employees = await model.findMany({ where: { tenantId } });
 */
export function cvisionModel(collectionName: string): PrismaDelegate {
  const modelName = COLLECTION_TO_PRISMA[collectionName];
  if (!modelName) {
    throw new Error(`[CVision] No Prisma model mapped for collection: ${collectionName}`);
  }
  const delegate = prisma[modelName as keyof typeof prisma];
  if (!delegate) {
    throw new Error(`[CVision] Prisma delegate not found: ${String(modelName)} (collection: ${collectionName})`);
  }
  return delegate as PrismaDelegate;
}

/**
 * Field name aliases — MongoDB-era names mapped to Prisma schema column names.
 * Automatically translated in mongoFilterToPrisma so old code keeps working.
 */
const FIELD_ALIASES: Record<string, string> = {
  joinDate: 'hiredAt',
  employeeNumber: 'employeeNo',
  jobTitle: 'jobTitleId',
  recipientId: 'userId',
  read: 'isRead',
  requesterId: 'requesterEmployeeId',
};

/**
 * Fields that don't exist in the Prisma schema — silently skip them
 * to avoid "Unknown argument" errors.
 */
const SKIP_FIELDS = new Set([
  'iqamaExpiry',
  'passportExpiry',
]);

/**
 * Fields that map to PostgreSQL enums — values must be UPPER_CASE.
 * The MongoDB-style code often passes lowercase variants; we auto-normalize here.
 */
const ENUM_FIELDS = new Set([
  'status', 'type', 'priority', 'gender', 'source', 'stage',
  'leaveType', 'loanStatus', 'contractType', 'contractStatus',
  'employmentType', 'shiftType', 'interviewType', 'interviewStatus',
  'offerStatus', 'requisitionStatus', 'requisitionReason',
  'candidateStatus', 'candidateSource', 'parseStatus',
  'attendanceStatus', 'scheduleApprovalStatus',
  'requestType', 'requestStatus', 'requestPriority',
  'payrollRunStatus', 'cvParseStatus', 'cvInboxItemStatus',
]);

function normalizeEnumValue(val: any): any {
  if (typeof val === 'string') return val.toUpperCase();
  return val;
}

function normalizeEnumArray(arr: any[]): any[] {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const v of arr) {
    const norm = typeof v === 'string' ? v.toUpperCase() : v;
    const key = String(norm);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(norm);
    }
  }
  return result;
}

/**
 * Convert a MongoDB-style filter to a Prisma `where` clause.
 *
 * Handles: $or, $and, $in, $nin, $gte, $lte, $gt, $lt, $ne, $regex, $exists, $not
 * Auto-normalizes enum field values to UPPER_CASE.
 */
export function mongoFilterToPrisma(filter: Record<string, any>): Record<string, any> {
  if (!filter || typeof filter !== 'object') return {};

  const where: Record<string, any> = {};

  for (const [key, value] of Object.entries(filter)) {
    // Logical operators
    if (key === '$or') {
      where.OR = (value as Record<string, unknown>[]).map(mongoFilterToPrisma);
      continue;
    }
    if (key === '$and') {
      where.AND = (value as Record<string, unknown>[]).map(mongoFilterToPrisma);
      continue;
    }
    if (key === '$nor') {
      where.NOT = { OR: (value as Record<string, unknown>[]).map(mongoFilterToPrisma) };
      continue;
    }

    // Skip MongoDB internal fields
    if (key === '_id') {
      where.id = value;
      continue;
    }

    // Skip fields that have no Prisma column equivalent
    if (SKIP_FIELDS.has(key)) continue;

    // Translate legacy field names to Prisma column names
    const resolvedKey = FIELD_ALIASES[key] || key;

    const isEnum = ENUM_FIELDS.has(resolvedKey);

    // Value is a simple value (not operator object)
    if (value === null || value === undefined || typeof value !== 'object' || value instanceof Date || Array.isArray(value)) {
      where[resolvedKey] = isEnum ? normalizeEnumValue(value) : value;
      continue;
    }

    // Value is an operator object like { $in: [...], $gte: 5, ... }
    if (hasMongoOperator(value)) {
      where[resolvedKey] = convertOperators(value, isEnum);
      continue;
    }

    // Plain object value (e.g., JSONB match)
    where[resolvedKey] = value;
  }

  return where;
}

function hasMongoOperator(obj: Record<string, any>): boolean {
  return Object.keys(obj).some((k) => k.startsWith('$'));
}

function filterUndefined(arr: any[]): any[] {
  return arr.filter((v) => v !== undefined);
}

function convertOperators(ops: Record<string, any>, isEnum = false): any {
  const result: Record<string, any> = {};

  for (const [op, val] of Object.entries(ops)) {
    switch (op) {
      case '$eq':
        // Mongo: { field: { $eq: x } } ≡ { field: x }. Prisma: { field: { equals: x } }.
        result.equals = isEnum ? normalizeEnumValue(val) : val;
        break;
      case '$in': {
        const cleaned = Array.isArray(val) ? filterUndefined(val) : val;
        result.in = isEnum && Array.isArray(cleaned) ? normalizeEnumArray(cleaned) : cleaned;
        break;
      }
      case '$nin': {
        const cleaned = Array.isArray(val) ? filterUndefined(val) : val;
        result.notIn = isEnum && Array.isArray(cleaned) ? normalizeEnumArray(cleaned) : cleaned;
        break;
      }
      case '$gte':
        result.gte = val;
        break;
      case '$gt':
        result.gt = val;
        break;
      case '$lte':
        result.lte = val;
        break;
      case '$lt':
        result.lt = val;
        break;
      case '$ne':
        result.not = val;
        break;
      case '$regex': {
        // $regex + $options:'i' → contains + mode:'insensitive'
        const caseInsensitive = ops.$options?.includes('i');
        result.contains = val instanceof RegExp ? val.source : String(val);
        if (caseInsensitive) result.mode = 'insensitive';
        break;
      }
      case '$options':
        // Handled by $regex
        break;
      case '$exists':
        if (val) {
          result.not = null;
        } else {
          // field doesn't exist → is null
          return null;
        }
        break;
      case '$not':
        if (typeof val === 'object' && val !== null) {
          result.not = convertOperators(val);
        } else {
          result.not = val;
        }
        break;
      default:
        // Unknown operator — pass through (may be a nested field)
        result[op] = val;
    }
  }

  // If only one key, simplify
  const keys = Object.keys(result);
  if (keys.length === 1 && keys[0] === 'not') return { not: result.not };
  if (keys.length === 0) return undefined;

  return result;
}

/**
 * Convert a MongoDB-style update to Prisma `data` object.
 *
 * Handles: $set, $unset, $inc
 * NOTE: $push, $pull, $addToSet require JSONB-aware handling per-field.
 */
export function mongoUpdateToPrisma(update: Record<string, any>): Record<string, any> {
  const data: Record<string, any> = {};

  if (update.$set) {
    Object.assign(data, update.$set);
  }

  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) {
      data[key] = null;
    }
  }

  if (update.$inc) {
    for (const [key, amount] of Object.entries(update.$inc)) {
      data[key] = { increment: amount };
    }
  }

  if (update.$setOnInsert) {
    // Used with upsert — merge into data, Prisma handles via create/update split
    Object.assign(data, update.$setOnInsert);
  }

  // Direct field assignments (no operator prefix)
  for (const [key, value] of Object.entries(update)) {
    if (!key.startsWith('$')) {
      data[key] = value;
    }
  }

  return data;
}

/**
 * Convert MongoDB sort to Prisma orderBy.
 * { createdAt: -1, name: 1 } → [{ createdAt: 'desc' }, { name: 'asc' }]
 */
export function mongoSortToPrisma(sort: Record<string, number>): Record<string, string>[] {
  return Object.entries(sort).map(([key, dir]) => ({
    [key]: dir === -1 ? 'desc' : 'asc',
  }));
}

/**
 * Convert MongoDB projection to Prisma select.
 * { id: 1, name: 1, email: 1 } → { id: true, name: true, email: true }
 */
export function mongoProjectToPrisma(projection: Record<string, number>): Record<string, boolean> {
  const select: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(projection)) {
    if (key === '_id') continue; // Skip MongoDB _id
    if (val === 1) select[key] = true;
  }
  return select;
}

export { COLLECTION_TO_PRISMA };
