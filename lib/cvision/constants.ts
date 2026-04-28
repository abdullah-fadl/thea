/**
 * CVision (HR OS) - Constants
 * 
 * All CVision enums, status values, and configuration constants.
 */

// Re-export CVISION_ROLES from roles.ts for convenience
export { CVISION_ROLES } from './roles';

// =============================================================================
// Employee Status
// =============================================================================

export const EMPLOYEE_STATUSES = [
  'active', 'probation',
  'on_annual_leave', 'on_sick_leave', 'on_maternity_leave', 'on_unpaid_leave',
  'suspended', 'suspended_without_pay',
  'notice_period',
  'resigned', 'terminated', 'end_of_contract', 'retired', 'deceased',
] as const;

export const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  active: 'Active', ACTIVE: 'Active',
  probation: 'Probation', PROBATION: 'Probation',
  on_annual_leave: 'Annual Leave', ON_ANNUAL_LEAVE: 'Annual Leave',
  on_sick_leave: 'Sick Leave', ON_SICK_LEAVE: 'Sick Leave',
  on_maternity_leave: 'Maternity Leave', ON_MATERNITY_LEAVE: 'Maternity Leave',
  on_unpaid_leave: 'Unpaid Leave', ON_UNPAID_LEAVE: 'Unpaid Leave',
  suspended: 'Suspended', SUSPENDED: 'Suspended',
  suspended_without_pay: 'Suspended Without Pay', SUSPENDED_WITHOUT_PAY: 'Suspended Without Pay',
  notice_period: 'Notice Period', NOTICE_PERIOD: 'Notice Period',
  resigned: 'Resigned', RESIGNED: 'Resigned',
  terminated: 'Terminated', TERMINATED: 'Terminated',
  end_of_contract: 'End of Contract', END_OF_CONTRACT: 'End of Contract',
  retired: 'Retired', RETIRED: 'Retired',
  deceased: 'Deceased', DECEASED: 'Deceased',
  on_leave: 'On Leave', ON_LEAVE: 'On Leave',
};

/**
 * Valid status transitions — delegates to status-engine.
 * Kept here for legacy consumers.
 */
export { STATUS_TRANSITIONS as EMPLOYEE_STATUS_TRANSITIONS } from './employees/status-engine';

export const ACTIVE_STATUSES = ['ACTIVE'] as const;
export const WORKING_STATUSES = ['ACTIVE', 'PROBATION'] as const;

// =============================================================================
// Request Types & Statuses
// =============================================================================

export const REQUEST_TYPES = [
  'leave',
  'salary_certificate',
  'employment_letter',
  'expense_claim',
  'complaint',
  'transfer',
  'training',
  'equipment',
  'payroll_issue',
  'other',
] as const;

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  leave: 'Leave Request',
  salary_certificate: 'Salary Certificate',
  employment_letter: 'Employment Letter',
  expense_claim: 'Expense Claim',
  complaint: 'Complaint',
  transfer: 'Transfer Request',
  training: 'Training Request',
  equipment: 'Equipment Request',
  payroll_issue: 'Payroll Issue',
  other: 'Other',
};

export const REQUEST_STATUSES = [
  'open',
  'in_review',
  'approved',
  'rejected',
  'escalated',
  'closed',
] as const;

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  escalated: 'Escalated',
  closed: 'Closed',
};

// =============================================================================
// Request Confidentiality
// =============================================================================

export const REQUEST_CONFIDENTIALITY_LEVELS = [
  'normal',
  'confidential',
  'anonymous',
] as const;

export const REQUEST_CONFIDENTIALITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  confidential: 'Confidential',
  anonymous: 'Anonymous',
};

// =============================================================================
// Request Owner Roles
// =============================================================================

export const REQUEST_OWNER_ROLES = [
  'manager',
  'hr',
  'compliance',
] as const;

export const REQUEST_OWNER_ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  hr: 'HR',
  compliance: 'Compliance',
};

// =============================================================================
// Request Event Types
// =============================================================================

export const REQUEST_EVENT_TYPES = [
  'created',
  'comment',
  'status_change',
  'escalated',
  'assigned',
  'attachment_added',
] as const;

export const REQUEST_EVENT_LABELS: Record<string, string> = {
  created: 'Request Created',
  comment: 'Comment Added',
  status_change: 'Status Changed',
  escalated: 'Escalated',
  assigned: 'Assigned',
  attachment_added: 'Attachment Added',
};

// =============================================================================
// SLA Configuration (in hours)
// =============================================================================

/**
 * SLA duration per request type (in hours)
 * Used to auto-calculate slaDueAt when a request is created
 */
export const REQUEST_SLA_HOURS: Record<string, number> = {
  leave: 48,                 // 2 days
  salary_certificate: 48,   // 2 days
  employment_letter: 48,    // 2 days
  expense_claim: 120,       // 5 days
  complaint: 72,             // 3 days
  transfer: 120,             // 5 days
  training: 96,              // 4 days
  equipment: 120,            // 5 days
  payroll_issue: 24,         // 1 day (urgent)
  other: 72,                 // 3 days default
};

/**
 * Escalation rules by confidentiality level
 * - normal: starts with manager
 * - confidential: starts with HR (bypasses manager)
 * - anonymous: starts with HR (bypasses manager)
 */
export const CONFIDENTIALITY_INITIAL_OWNER: Record<string, string> = {
  normal: 'manager',
  confidential: 'hr',
  anonymous: 'hr',
};

/**
 * Escalation path: manager -> hr -> compliance
 */
export const ESCALATION_PATH: Record<string, string | null> = {
  manager: 'hr',
  hr: 'compliance',
  compliance: null, // Terminal - cannot escalate further
};

/**
 * Types that require HR involvement regardless of confidentiality
 */
export const HR_REQUIRED_REQUEST_TYPES = [
  'complaint',
  'payroll_issue',
];

export const REQUEST_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export const REQUEST_PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

/**
 * Valid status transitions for requests
 */
export const REQUEST_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['in_review', 'closed'],
  in_review: ['approved', 'rejected', 'escalated', 'closed'],
  approved: ['closed'],
  rejected: ['closed'], // Can be closed after rejection
  escalated: ['in_review', 'approved', 'rejected', 'closed'],
  closed: [], // Terminal state
};

// =============================================================================
// Recruitment
// =============================================================================

export const REQUISITION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'OPEN',
  'CLOSED',
  'CANCELLED',
] as const;

export const REQUISITION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  OPEN: 'Open',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
  // Legacy lowercase aliases for backward compat
  draft: 'Draft',
  submitted: 'Submitted',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  open: 'Open',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const REQUISITION_REASONS = [
  'NEW_POSITION',
  'REPLACEMENT',
  'BACKFILL',
  'EXPANSION',
  'OTHER',
] as const;

export const REQUISITION_REASON_LABELS: Record<string, string> = {
  NEW_POSITION: 'New Position',
  REPLACEMENT: 'Replacement',
  BACKFILL: 'Backfill',
  EXPANSION: 'Expansion',
  OTHER: 'Other',
  // Legacy lowercase aliases for backward compat
  new_role: 'New Position',
  backfill: 'Backfill',
  temp: 'Temporary Coverage',
  other: 'Other',
};

/**
 * Valid status transitions for requisitions
 */
export const REQUISITION_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'PENDING_APPROVAL'],
  SUBMITTED: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['OPEN', 'CLOSED'],
  REJECTED: [], // Terminal (can create new requisition)
  OPEN: ['CLOSED'],
  CLOSED: [], // Terminal
  CANCELLED: [], // Terminal
};

export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'temporary',
  'internship',
] as const;

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  temporary: 'Temporary',
  internship: 'Internship',
};

// =============================================================================
// Contract Types
// =============================================================================

export const CONTRACT_TYPES = [
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'FIXED_TERM', label: 'Fixed-term' },
  { value: 'LOCUM', label: 'Locum' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'INTERN', label: 'Intern' },
] as const;

export const CONTRACT_TYPE_VALUES = CONTRACT_TYPES.map(t => t.value) as readonly string[];

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  PERMANENT: 'Permanent',
  FIXED_TERM: 'Fixed-term',
  LOCUM: 'Locum',
  PART_TIME: 'Part-time',
  INTERN: 'Intern',
};

// =============================================================================
// Candidate Status & Source
// =============================================================================

export const CANDIDATE_STATUSES = [
  'applied',
  'new',
  'screening',
  'screened',
  'shortlisted',
  'interview',
  'offer',
  'hired',
  'rejected',
  'APPLIED',
  'NEW',
  'SCREENING',
  'SCREENED',
  'SHORTLISTED',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
] as const;

export const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  applied: 'Applied',
  new: 'New',
  screening: 'Screening',
  screened: 'Screened',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

export const CANDIDATE_SOURCES = [
  'portal',
  'referral',
  'agency',
  'direct',
  'other',
  'cv_inbox',
  'PORTAL',
  'REFERRAL',
  'AGENCY',
  'DIRECT',
  'OTHER',
  'CV_INBOX',
  'LINKEDIN',
] as const;

export const CANDIDATE_SOURCE_LABELS: Record<string, string> = {
  portal: 'Career Portal',
  referral: 'Employee Referral',
  agency: 'Recruitment Agency',
  other: 'Other',
};

/**
 * Valid status transitions for candidates
 */
export const CANDIDATE_STATUS_TRANSITIONS: Record<string, string[]> = {
  applied: ['screening', 'screened', 'shortlisted', 'interview', 'rejected'],
  new: ['screening', 'screened', 'shortlisted', 'interview', 'rejected'],
  screening: ['new', 'shortlisted', 'interview', 'rejected'],
  screened: ['new', 'shortlisted', 'interview', 'rejected'],
  shortlisted: ['new', 'interview', 'offer', 'rejected'],
  interview: ['new', 'offer', 'shortlisted', 'hired', 'rejected'],
  offer: ['new', 'hired', 'rejected'],
  hired: [], // Terminal
  rejected: [], // Terminal
};

// =============================================================================
// Candidate Document Types
// =============================================================================

export const CANDIDATE_DOCUMENT_KINDS = [
  'cv',
  'certificate',
  'other',
] as const;

export const CANDIDATE_DOCUMENT_KIND_LABELS: Record<string, string> = {
  cv: 'CV / Resume',
  certificate: 'Certificate',
  other: 'Other Document',
};

// Legacy aliases for compatibility
export const CANDIDATE_STAGES = CANDIDATE_STATUSES;
export const CANDIDATE_STAGE_LABELS = CANDIDATE_STATUS_LABELS;
export const CANDIDATE_STAGE_TRANSITIONS = CANDIDATE_STATUS_TRANSITIONS;

// =============================================================================
// Collections
// =============================================================================

export const CVISION_COLLECTIONS = {
  departments: 'cvision_departments',
  units: 'cvision_units',
  jobTitles: 'cvision_job_titles',
  grades: 'cvision_grades',
  employees: 'cvision_employees',
  employeeStatusHistory: 'cvision_employee_status_history',
  employeeOnboarding: 'cvision_employee_onboarding',
  onboardingTemplates: 'cvision_onboarding_templates',
  offboarding: 'cvision_offboarding',
  employeeDocuments: 'cvision_employee_documents',
  insuranceProviders: 'cvision_insurance_providers',
  insurancePolicies: 'cvision_insurance_policies',
  employeeInsurance: 'cvision_employee_insurances',
  insuranceClaims: 'cvision_insurance_claims',
  insuranceRequests: 'cvision_insurance_requests',
  requests: 'cvision_requests',
  requestEvents: 'cvision_request_events',
  jobRequisitions: 'cvision_job_requisitions',
  candidates: 'cvision_candidates',
  candidateDocuments: 'cvision_candidate_documents',
  auditLogs: 'cvision_audit_logs',
  authEvents: 'cvision_auth_events',
  positions: 'cvision_positions', // Legacy
  budgetedPositions: 'cvision_budgeted_positions', // PR-D: Budget v1
  positionSlots: 'cvision_position_slots', // PR-B: Position Lifecycle
  jobPostings: 'cvision_job_postings',
  killoutQuestions: 'cvision_killout_questions',
  applications: 'cvision_applications',
  cvParseJobs: 'cvision_cv_parse_jobs',
  cvInboxBatches: 'cvision_cv_inbox_batches',
  cvInboxItems: 'cvision_cv_inbox_items',
  payrollProfiles: 'cvision_payroll_profiles',
  loans: 'cvision_loans',
  loanPolicies: 'cvision_loan_policies',
  payrollRuns: 'cvision_payroll_runs',
  payslips: 'cvision_payslips',
  payrollExports: 'cvision_payroll_exports',
  payrollDryRuns: 'cvision_payroll_dry_runs',
  journalEntries: 'cvision_journal_entries',
  glMapping: 'cvision_gl_mapping',
  departmentBudgets: 'cvision_department_budgets',
  profileSectionSchemas: 'cvision_profile_section_schemas',
  employeeProfileSections: 'cvision_employee_profile_sections',
  employeeProfileSectionHistory: 'cvision_employee_profile_section_history',
  positionTypes: 'cvision_position_types',
  departmentPositions: 'cvision_department_positions',
  manpowerPlans: 'cvision_manpower_plans',
  contracts: 'cvision_contracts',
  notifications: 'cvision_notifications',
  assignments: 'cvision_assignments',
  scheduleEntries: 'cvision_schedule_entries',
  scheduleApprovals: 'cvision_schedule_approvals',
  shifts: 'cvision_shifts',
  leaves: 'cvision_leaves',
  disciplinary: 'cvision_disciplinary',
  performanceReviews: 'cvision_performance_reviews',
  reviewCycles: 'cvision_review_cycles',
  promotions: 'cvision_promotions',
  muqeemRecords: 'cvision_muqeem_records',
  muqeemAlerts: 'cvision_muqeem_alerts',
  integrationConfigs: 'cvision_integration_configs',
  integrationLogs: 'cvision_integration_logs',
  retentionScores: 'cvision_retention_scores',
  retentionAlerts: 'cvision_retention_alerts',
  branches: 'cvision_branches',
  talentPool: 'cvision_talent_pool',
  candidateRankings: 'cvision_candidate_rankings',
  candidateInteractions: 'cvision_candidate_interactions',
  interviews: 'cvision_interviews',
  interviewSessions: 'cvision_interview_sessions',
  shiftTemplates: 'cvision_shift_templates',
  shiftAssignments: 'cvision_shift_assignments',
  employeeShiftPreferences: 'cvision_employee_shift_preferences',
  departmentWorkSchedules: 'cvision_department_work_schedules',
  aiThresholds: 'cvision_ai_thresholds',
  reviewQueue: 'cvision_review_queue',
  decisionOutcomes: 'cvision_decision_outcomes',
  trainingCourses: 'cvision_training_courses',
  trainingEnrollments: 'cvision_training_enrollments',
  trainingBudget: 'cvision_training_budget',
  recognitions: 'cvision_recognitions',
  rewardPoints: 'cvision_reward_points',
  salaryStructure: 'cvision_salary_structure',
  employeeCompensation: 'cvision_employee_compensation',
  companyPolicies: 'cvision_company_policies',
  notificationCenter: 'cvision_notification_center',
  notificationPreferences: 'cvision_notification_preferences',
  letters: 'cvision_letters',
  letterTemplates: 'cvision_letter_templates',
  onboardingProcesses: 'cvision_onboarding_processes',
  headcountBudget: 'cvision_headcount_budget',
  positionRequests: 'cvision_position_requests',
  integrationsConfig: 'cvision_integrations',
  savedReports: 'cvision_saved_reports',
  deletedRecords: 'cvision_deleted_records',
  undoStack: 'cvision_undo_stack',

  // ── Access Control & Delegation ──────────────────────────────────
  delegations: 'cvision_delegations',
  approvalMatrix: 'cvision_approval_matrix',
  workflows: 'cvision_workflows',
  workflowInstances: 'cvision_workflow_instances',
  tenantSettings: 'cvision_tenant_settings',
  importJobs: 'cvision_import_jobs',
  onboardingInstances: 'cvision_onboarding_instances',
  policies: 'cvision_policies',
  policyAcknowledgments: 'cvision_policy_acknowledgments',
  calendarEvents: 'cvision_calendar_events',
  okrs: 'cvision_okrs',
  kpis: 'cvision_kpis',
  successionPlans: 'cvision_succession_plans',
  surveys: 'cvision_surveys',
  surveyResponses: 'cvision_survey_responses',
  travelRequests: 'cvision_travel_requests',
  expenses: 'cvision_expenses',
  grievances: 'cvision_grievances',
  assets: 'cvision_assets',
  safetyIncidents: 'cvision_safety_incidents',
  teams: 'cvision_teams',
  announcements: 'cvision_announcements',
  orgHealthAssessments: 'cvision_org_health_assessments',
  changeInitiatives: 'cvision_change_initiatives',
  orgDesigns: 'cvision_org_designs',
  cultureAssessments: 'cvision_culture_assessments',
  processAnalysis: 'cvision_process_analysis',
  strategicAlignment: 'cvision_strategic_alignment',

  // ── Transportation ────────────────────────────────────────────────
  transportRoutes: 'cvision_transport_routes',
  transportVehicles: 'cvision_transport_vehicles',
  transportAssignments: 'cvision_transport_assignments',
  transportRequests: 'cvision_transport_requests',
  transportTrips: 'cvision_transport_trips',
  transportIssues: 'cvision_transport_issues',
} as const;

// =============================================================================
// Permissions
// =============================================================================

export const CVISION_PERMISSIONS = {
  // Dashboard
  VIEW: 'cvision.view',
  
  // Organization
  ORG_READ: 'cvision.org.read',
  ORG_WRITE: 'cvision.org.write',
  
  // Employees
  EMPLOYEES_READ: 'cvision.employees.read',
  EMPLOYEES_WRITE: 'cvision.employees.write',
  EMPLOYEES_STATUS: 'cvision.employees.status',
  EMPLOYEES_DELETE: 'cvision.employees.delete',
  
  // Requests
  REQUESTS_READ: 'cvision.requests.read',
  REQUESTS_WRITE: 'cvision.requests.write',
  REQUESTS_APPROVE: 'cvision.requests.approve',
  REQUESTS_ESCALATE: 'cvision.requests.escalate',
  
  // Recruitment
  RECRUITMENT_READ: 'cvision.recruitment.read',
  RECRUITMENT_WRITE: 'cvision.recruitment.write',
  RECRUITMENT_APPROVE: 'cvision.recruitment.approve',
  
  // Payroll
  PAYROLL_READ: 'cvision.payroll.read',
  PAYROLL_WRITE: 'cvision.payroll.write',
  PAYROLL_APPROVE: 'cvision.payroll.approve',
  
  // Scheduling
  SCHEDULING_READ: 'cvision.scheduling.read',
  SCHEDULING_WRITE: 'cvision.scheduling.write',
  SCHEDULING_APPROVE: 'cvision.scheduling.approve',

  // Disciplinary
  DISCIPLINARY_READ: 'cvision.disciplinary.read',
  DISCIPLINARY_WRITE: 'cvision.disciplinary.write',
  DISCIPLINARY_APPROVE: 'cvision.disciplinary.approve',

  // Performance
  PERFORMANCE_READ: 'cvision.performance.read',
  PERFORMANCE_WRITE: 'cvision.performance.write',
  PERFORMANCE_CALIBRATE: 'cvision.performance.calibrate',

  // Promotions
  PROMOTIONS_READ: 'cvision.promotions.read',
  PROMOTIONS_WRITE: 'cvision.promotions.write',
  PROMOTIONS_APPROVE: 'cvision.promotions.approve',

  // Muqeem (Iqama & Visa)
  MUQEEM_READ: 'cvision.muqeem.read',
  MUQEEM_WRITE: 'cvision.muqeem.write',

  // Integrations
  INTEGRATIONS_READ: 'cvision.integrations.read',
  INTEGRATIONS_WRITE: 'cvision.integrations.write',

  // Config
  CONFIG_WRITE: 'cvision.config.write',

  // ── New granular permissions ─────────────────────────────────────
  // Attendance
  ATTENDANCE_READ: 'cvision.attendance.read',
  ATTENDANCE_WRITE: 'cvision.attendance.write',
  ATTENDANCE_APPROVE: 'cvision.attendance.approve',

  // Leaves
  LEAVES_READ: 'cvision.leaves.read',
  LEAVES_WRITE: 'cvision.leaves.write',
  LEAVES_APPROVE: 'cvision.leaves.approve',

  // Loans
  LOANS_READ: 'cvision.loans.read',
  LOANS_WRITE: 'cvision.loans.write',
  LOANS_APPROVE: 'cvision.loans.approve',

  // Contracts
  CONTRACTS_READ: 'cvision.contracts.read',
  CONTRACTS_WRITE: 'cvision.contracts.write',

  // Letters
  LETTERS_READ: 'cvision.letters.read',
  LETTERS_WRITE: 'cvision.letters.write',
  LETTERS_APPROVE: 'cvision.letters.approve',

  // Training
  TRAINING_READ: 'cvision.training.read',
  TRAINING_WRITE: 'cvision.training.write',
  TRAINING_APPROVE: 'cvision.training.approve',

  // Insurance
  INSURANCE_READ: 'cvision.insurance.read',
  INSURANCE_WRITE: 'cvision.insurance.write',

  // Travel
  TRAVEL_READ: 'cvision.travel.read',
  TRAVEL_WRITE: 'cvision.travel.write',
  TRAVEL_APPROVE: 'cvision.travel.approve',

  // Compensation
  COMPENSATION_READ: 'cvision.compensation.read',
  COMPENSATION_WRITE: 'cvision.compensation.write',

  // Rewards
  REWARDS_READ: 'cvision.rewards.read',
  REWARDS_WRITE: 'cvision.rewards.write',

  // Succession
  SUCCESSION_READ: 'cvision.succession.read',
  SUCCESSION_WRITE: 'cvision.succession.write',

  // Policies
  POLICIES_READ: 'cvision.policies.read',
  POLICIES_WRITE: 'cvision.policies.write',

  // Surveys
  SURVEYS_READ: 'cvision.surveys.read',
  SURVEYS_WRITE: 'cvision.surveys.write',

  // Grievances
  GRIEVANCES_READ: 'cvision.grievances.read',
  GRIEVANCES_WRITE: 'cvision.grievances.write',

  // Assets
  ASSETS_READ: 'cvision.assets.read',
  ASSETS_WRITE: 'cvision.assets.write',

  // Compliance
  COMPLIANCE_READ: 'cvision.compliance.read',
  COMPLIANCE_WRITE: 'cvision.compliance.write',

  // Safety
  SAFETY_READ: 'cvision.safety.read',
  SAFETY_WRITE: 'cvision.safety.write',

  // Reports
  REPORTS_READ: 'cvision.reports.read',
  REPORTS_EXPORT: 'cvision.reports.export',

  // Workflows
  WORKFLOWS_READ: 'cvision.workflows.read',
  WORKFLOWS_WRITE: 'cvision.workflows.write',

  // Notifications
  NOTIFICATIONS_READ: 'cvision.notifications.read',
  NOTIFICATIONS_WRITE: 'cvision.notifications.write',

  // Onboarding
  ONBOARDING_READ: 'cvision.onboarding.read',
  ONBOARDING_WRITE: 'cvision.onboarding.write',

  // Miscellaneous
  SELF_SERVICE: 'cvision.self_service',
  AUDIT_READ: 'cvision.audit.read',
  DELEGATION_MANAGE: 'cvision.delegation.manage',
  BULK_OPERATIONS: 'cvision.bulk_operations',
  IMPORT_EXECUTE: 'cvision.import.execute',
  EXPORT_EXECUTE: 'cvision.export.execute',

  // Infrastructure (Systems 27-36)
  INTEGRATIONS_MANAGE: 'cvision.integrations.manage',
  DASHBOARDS_READ: 'cvision.dashboards.read',
  DASHBOARDS_WRITE: 'cvision.dashboards.write',
  WEBHOOKS_MANAGE: 'cvision.webhooks.manage',
  FILES_READ: 'cvision.files.read',
  FILES_WRITE: 'cvision.files.write',
  BRANCHES_READ: 'cvision.branches.read',
  BRANCHES_WRITE: 'cvision.branches.write',
  ORG_STRUCTURE_WRITE: 'cvision.org_structure.write',
  MANPOWER_READ: 'cvision.manpower.read',
  MANPOWER_WRITE: 'cvision.manpower.write',

  // OD Modules (Systems 21-26)
  ORG_HEALTH_READ: 'cvision.org_health.read',
  ORG_HEALTH_WRITE: 'cvision.org_health.write',
  CHANGE_MGMT_READ: 'cvision.change_mgmt.read',
  CHANGE_MGMT_WRITE: 'cvision.change_mgmt.write',
  ORG_DESIGN_READ: 'cvision.org_design.read',
  ORG_DESIGN_WRITE: 'cvision.org_design.write',
  CULTURE_READ: 'cvision.culture.read',
  CULTURE_WRITE: 'cvision.culture.write',
  PROCESS_READ: 'cvision.process.read',
  PROCESS_WRITE: 'cvision.process.write',
  STRATEGIC_READ: 'cvision.strategic.read',
  STRATEGIC_WRITE: 'cvision.strategic.write',
} as const;

const P = CVISION_PERMISSIONS;
const ALL_PERMISSIONS = Object.values(CVISION_PERMISSIONS) as string[];
const ALL_READ_PERMISSIONS = ALL_PERMISSIONS.filter(p => p.endsWith('.read') || p === P.VIEW || p === P.AUDIT_READ || p === P.REPORTS_READ || p === P.SELF_SERVICE);

/**
 * Default permissions by role
 */
export const CVISION_ROLE_PERMISSIONS: Record<string, string[]> = {
  // owner / cvision_admin: everything
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  cvision_admin: ALL_PERMISSIONS,

  // hr-admin: everything except CONFIG_WRITE
  'hr-admin': ALL_PERMISSIONS.filter(p => p !== P.CONFIG_WRITE),

  // hr-manager: HR operations + approvals (no payroll write, no config)
  'hr-manager': [
    P.VIEW, P.ORG_READ, P.ORG_WRITE,
    P.EMPLOYEES_READ, P.EMPLOYEES_WRITE, P.EMPLOYEES_STATUS,
    P.REQUESTS_READ, P.REQUESTS_WRITE, P.REQUESTS_APPROVE, P.REQUESTS_ESCALATE,
    P.RECRUITMENT_READ, P.RECRUITMENT_WRITE, P.RECRUITMENT_APPROVE,
    P.PAYROLL_READ,
    P.SCHEDULING_READ, P.SCHEDULING_WRITE, P.SCHEDULING_APPROVE,
    P.DISCIPLINARY_READ, P.DISCIPLINARY_WRITE, P.DISCIPLINARY_APPROVE,
    P.PERFORMANCE_READ, P.PERFORMANCE_WRITE, P.PERFORMANCE_CALIBRATE,
    P.PROMOTIONS_READ, P.PROMOTIONS_WRITE, P.PROMOTIONS_APPROVE,
    P.MUQEEM_READ, P.MUQEEM_WRITE,
    P.ATTENDANCE_READ, P.ATTENDANCE_WRITE, P.ATTENDANCE_APPROVE,
    P.LEAVES_READ, P.LEAVES_WRITE, P.LEAVES_APPROVE,
    P.LOANS_READ, P.LOANS_WRITE, P.LOANS_APPROVE,
    P.CONTRACTS_READ, P.CONTRACTS_WRITE,
    P.LETTERS_READ, P.LETTERS_WRITE, P.LETTERS_APPROVE,
    P.TRAINING_READ, P.TRAINING_WRITE, P.TRAINING_APPROVE,
    P.INSURANCE_READ, P.INSURANCE_WRITE,
    P.TRAVEL_READ, P.TRAVEL_WRITE, P.TRAVEL_APPROVE,
    P.COMPENSATION_READ,
    P.REWARDS_READ, P.REWARDS_WRITE,
    P.SUCCESSION_READ, P.SUCCESSION_WRITE,
    P.POLICIES_READ, P.POLICIES_WRITE,
    P.SURVEYS_READ, P.SURVEYS_WRITE,
    P.GRIEVANCES_READ, P.GRIEVANCES_WRITE,
    P.ASSETS_READ, P.ASSETS_WRITE,
    P.COMPLIANCE_READ, P.COMPLIANCE_WRITE,
    P.SAFETY_READ, P.SAFETY_WRITE,
    P.REPORTS_READ, P.REPORTS_EXPORT,
    P.WORKFLOWS_READ, P.WORKFLOWS_WRITE,
    P.NOTIFICATIONS_READ, P.NOTIFICATIONS_WRITE,
    P.ONBOARDING_READ, P.ONBOARDING_WRITE,
    P.DELEGATION_MANAGE, P.BULK_OPERATIONS,
    P.IMPORT_EXECUTE, P.EXPORT_EXECUTE,
    P.INTEGRATIONS_READ, P.INTEGRATIONS_MANAGE,
    P.DASHBOARDS_READ, P.DASHBOARDS_WRITE,
    P.WEBHOOKS_MANAGE,
    P.FILES_READ, P.FILES_WRITE,
    P.BRANCHES_READ, P.BRANCHES_WRITE,
    P.ORG_STRUCTURE_WRITE,
    P.MANPOWER_READ, P.MANPOWER_WRITE,
    P.ORG_HEALTH_READ, P.ORG_HEALTH_WRITE,
    P.CHANGE_MGMT_READ, P.CHANGE_MGMT_WRITE,
    P.ORG_DESIGN_READ, P.ORG_DESIGN_WRITE,
    P.CULTURE_READ, P.CULTURE_WRITE,
    P.PROCESS_READ, P.PROCESS_WRITE,
    P.STRATEGIC_READ, P.STRATEGIC_WRITE,
  ],

  // manager: team approvals (leaves, loans, travel, training, performance)
  manager: [
    P.VIEW,
    P.ORG_READ, P.EMPLOYEES_READ,
    P.REQUESTS_READ, P.REQUESTS_WRITE, P.REQUESTS_APPROVE,
    P.ATTENDANCE_READ,
    P.LEAVES_READ, P.LEAVES_APPROVE,
    P.LOANS_READ, P.LOANS_APPROVE,
    P.TRAVEL_READ, P.TRAVEL_APPROVE,
    P.TRAINING_READ, P.TRAINING_APPROVE,
    P.PERFORMANCE_READ, P.PERFORMANCE_WRITE,
    P.SCHEDULING_READ,
    P.REPORTS_READ,
    P.NOTIFICATIONS_READ, P.NOTIFICATIONS_WRITE,
    P.POLICIES_READ,
    P.DELEGATION_MANAGE,
    P.SELF_SERVICE,
  ],

  // recruiter: recruitment only
  recruiter: [
    P.VIEW,
    P.ORG_READ, P.EMPLOYEES_READ,
    P.RECRUITMENT_READ, P.RECRUITMENT_WRITE,
    P.ONBOARDING_READ,
    P.NOTIFICATIONS_READ,
    P.SELF_SERVICE,
  ],

  // supervisor: leaves approve + attendance read
  supervisor: [
    P.VIEW,
    P.ORG_READ, P.EMPLOYEES_READ,
    P.ATTENDANCE_READ,
    P.LEAVES_READ, P.LEAVES_APPROVE,
    P.REQUESTS_READ, P.REQUESTS_WRITE,
    P.PERFORMANCE_READ, P.PERFORMANCE_WRITE,
    P.NOTIFICATIONS_READ,
    P.POLICIES_READ,
    P.SELF_SERVICE,
  ],

  // auditor: read everything, write nothing
  auditor: [
    ...ALL_READ_PERMISSIONS,
    P.AUDIT_READ, P.REPORTS_READ, P.REPORTS_EXPORT,
  ],

  // employee / staff: self-service + notifications + policies read
  employee: [
    P.VIEW, P.SELF_SERVICE,
    P.NOTIFICATIONS_READ,
    P.POLICIES_READ,
    P.REQUESTS_READ,
    P.PERFORMANCE_READ,
    P.LEAVES_READ,
    P.ATTENDANCE_READ,
    P.TRAINING_READ,
  ],
  staff: [
    P.VIEW, P.SELF_SERVICE,
    P.NOTIFICATIONS_READ,
    P.POLICIES_READ,
    P.REQUESTS_READ,
    P.PERFORMANCE_READ,
    P.LEAVES_READ,
    P.ATTENDANCE_READ,
    P.TRAINING_READ,
  ],
};

// =============================================================================
// Pagination
// =============================================================================

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// =============================================================================
// Number Sequences
// =============================================================================

export const SEQUENCE_PREFIXES = {
  employee: 'EMP',
  request: 'REQ',
  requisition: 'JR',
  candidate: 'CND',
  contract: 'CON',
  warning: 'WARN',
  reviewCycle: 'RC',
  review: 'PR',
  promotion: 'PROMO',
} as const;
