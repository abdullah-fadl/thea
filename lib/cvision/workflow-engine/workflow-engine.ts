import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type StepType = 'APPROVAL' | 'NOTIFICATION' | 'CONDITION' | 'ACTION' | 'PARALLEL';
export type ApproverType = 'SPECIFIC_USER' | 'ROLE' | 'DIRECT_MANAGER' | 'DEPARTMENT_HEAD' | 'HR' | 'FINANCE' | 'DYNAMIC';
export type InstanceStatus = 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'ESCALATED';
export type StepAction = 'APPROVED' | 'REJECTED' | 'DELEGATED' | 'ESCALATED' | 'SKIPPED' | 'AUTO';

const TEMPLATES_COLL = 'cvision_workflows';
const INSTANCES_COLL = 'cvision_workflow_instances';

/* ── Seed Data ─────────────────────────────────────────────────────── */

const SEED_TEMPLATES = [
  /* ── 1. Leave Approval ─────────────────────────────────────────────── */
  {
    workflowId: 'WF-001', name: 'Leave Approval', nameAr: 'اعتماد الإجازة', module: 'leaves', triggerEvent: 'leave.requested',
    steps: [
      { stepId: 'S1', name: 'Check Duration', order: 1, type: 'CONDITION' as StepType, condition: { field: 'days', operator: 'GREATER', value: 5, trueStepId: 'S3', falseStepId: 'S2' }, allowDelegation: false },
      { stepId: 'S2', name: 'Direct Manager Approval', order: 2, type: 'APPROVAL' as StepType, approverType: 'DIRECT_MANAGER' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S3', name: 'Department Head Approval', order: 3, type: 'APPROVAL' as StepType, approverType: 'DEPARTMENT_HEAD' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S4', name: 'Check Extended Leave', order: 4, type: 'CONDITION' as StepType, condition: { field: 'days', operator: 'GREATER', value: 15, trueStepId: 'S5', falseStepId: 'S6' }, allowDelegation: false },
      { stepId: 'S5', name: 'HR Approval', order: 5, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 24, allowDelegation: true },
      { stepId: 'S6', name: 'Update Status', order: 6, type: 'ACTION' as StepType, action: { type: 'UPDATE_STATUS', config: { status: 'APPROVED' } }, allowDelegation: false },
      { stepId: 'S7', name: 'Notify Employee', order: 7, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER', message: 'Your leave has been approved' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'APPROVED' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'REJECTED' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 2. Loan Request ────────────────────────────────────────────────── */
  {
    workflowId: 'WF-002', name: 'Loan Request', nameAr: 'طلب سلفة', module: 'loans', triggerEvent: 'loan.submitted',
    steps: [
      { stepId: 'S1', name: 'HR Review', order: 1, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 72, allowDelegation: true },
      { stepId: 'S2', name: 'Check Amount', order: 2, type: 'CONDITION' as StepType, condition: { field: 'amount', operator: 'GREATER', value: 10000, trueStepId: 'S3', falseStepId: 'S4' }, allowDelegation: false },
      { stepId: 'S3', name: 'Finance Approval', order: 3, type: 'APPROVAL' as StepType, approverType: 'FINANCE' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S4', name: 'Process Loan', order: 4, type: 'ACTION' as StepType, action: { type: 'CREATE_RECORD', config: { collection: 'loans', status: 'APPROVED' } }, allowDelegation: false },
      { stepId: 'S5', name: 'Notify Employee', order: 5, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER', message: 'Your loan has been processed' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'DISBURSED' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'REJECTED' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 3. Purchase Request ────────────────────────────────────────────── */
  {
    workflowId: 'WF-003', name: 'Purchase Request', nameAr: 'طلب شراء', module: 'procurement', triggerEvent: 'purchase.requested',
    steps: [
      { stepId: 'S1', name: 'Manager Approval', order: 1, type: 'APPROVAL' as StepType, approverType: 'DIRECT_MANAGER' as ApproverType, slaHours: 24, allowDelegation: true },
      { stepId: 'S2', name: 'Budget Check', order: 2, type: 'CONDITION' as StepType, condition: { field: 'amount', operator: 'GREATER', value: 5000, trueStepId: 'S3', falseStepId: 'S4' }, allowDelegation: false },
      { stepId: 'S3', name: 'Finance Approval', order: 3, type: 'APPROVAL' as StepType, approverType: 'FINANCE' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S4', name: 'Create PO', order: 4, type: 'ACTION' as StepType, action: { type: 'CREATE_RECORD', config: { collection: 'purchase_orders' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'APPROVED' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'REJECTED' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 4. Travel Request ──────────────────────────────────────────────── */
  {
    workflowId: 'WF-004', name: 'Travel Request', nameAr: 'طلب سفر', module: 'travel', triggerEvent: 'travel.requested',
    steps: [
      { stepId: 'S1', name: 'Manager Approval', order: 1, type: 'APPROVAL' as StepType, approverType: 'DIRECT_MANAGER' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S2', name: 'Check Budget', order: 2, type: 'CONDITION' as StepType, condition: { field: 'estimatedCost', operator: 'GREATER', value: 5000, trueStepId: 'S3', falseStepId: 'S4' }, allowDelegation: false },
      { stepId: 'S3', name: 'Finance Approval', order: 3, type: 'APPROVAL' as StepType, approverType: 'FINANCE' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S4', name: 'HR Acknowledgement', order: 4, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 24, allowDelegation: true },
      { stepId: 'S5', name: 'Approve Travel', order: 5, type: 'ACTION' as StepType, action: { type: 'UPDATE_STATUS', config: { status: 'APPROVED' } }, allowDelegation: false },
      { stepId: 'S6', name: 'Notify Employee', order: 6, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER', message: 'Your travel request has been approved' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'APPROVED' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'REJECTED' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 5. Letter Request ──────────────────────────────────────────────── */
  {
    workflowId: 'WF-005', name: 'Letter Request', nameAr: 'طلب خطاب', module: 'letters', triggerEvent: 'letter.requested',
    steps: [
      { stepId: 'S1', name: 'HR Review', order: 1, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 24, allowDelegation: true },
      { stepId: 'S2', name: 'Generate Letter', order: 2, type: 'ACTION' as StepType, action: { type: 'CREATE_RECORD', config: { collection: 'letters', status: 'GENERATED' } }, allowDelegation: false },
      { stepId: 'S3', name: 'Notify Employee', order: 3, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER', message: 'Your letter is ready for pickup' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'COMPLETED' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'REJECTED' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 6. Resignation ─────────────────────────────────────────────────── */
  {
    workflowId: 'WF-006', name: 'Resignation', nameAr: 'استقالة', module: 'employees', triggerEvent: 'resignation.submitted',
    steps: [
      { stepId: 'S1', name: 'Manager Approval', order: 1, type: 'APPROVAL' as StepType, approverType: 'DIRECT_MANAGER' as ApproverType, slaHours: 72, allowDelegation: true },
      { stepId: 'S2', name: 'Department Head Approval', order: 2, type: 'APPROVAL' as StepType, approverType: 'DEPARTMENT_HEAD' as ApproverType, slaHours: 72, allowDelegation: true },
      { stepId: 'S3', name: 'HR Admin Approval', order: 3, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 120, allowDelegation: true },
      { stepId: 'S4', name: 'Process Resignation', order: 4, type: 'ACTION' as StepType, action: { type: 'UPDATE_STATUS', config: { collection: 'employees', status: 'RESIGNED' } }, allowDelegation: false },
      { stepId: 'S5', name: 'Notify Employee', order: 5, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER', message: 'Your resignation has been processed' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'RESIGNED' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'ACTIVE' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 7. Training Request ────────────────────────────────────────────── */
  {
    workflowId: 'WF-007', name: 'Training Request', nameAr: 'طلب تدريب', module: 'training', triggerEvent: 'training.requested',
    steps: [
      { stepId: 'S1', name: 'Manager Approval', order: 1, type: 'APPROVAL' as StepType, approverType: 'DIRECT_MANAGER' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S2', name: 'HR Review', order: 2, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S3', name: 'Check Cost', order: 3, type: 'CONDITION' as StepType, condition: { field: 'cost', operator: 'GREATER', value: 3000, trueStepId: 'S4', falseStepId: 'S5' }, allowDelegation: false },
      { stepId: 'S4', name: 'Finance Approval', order: 4, type: 'APPROVAL' as StepType, approverType: 'FINANCE' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S5', name: 'Enroll Employee', order: 5, type: 'ACTION' as StepType, action: { type: 'UPDATE_STATUS', config: { status: 'ENROLLED' } }, allowDelegation: false },
      { stepId: 'S6', name: 'Notify Employee', order: 6, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER', message: 'You have been enrolled in the training program' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'APPROVED' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'REJECTED' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 8. Promotion Request ───────────────────────────────────────────── */
  {
    workflowId: 'WF-008', name: 'Promotion Request', nameAr: 'طلب ترقية', module: 'promotions', triggerEvent: 'promotion.requested',
    steps: [
      { stepId: 'S1', name: 'Department Head Review', order: 1, type: 'APPROVAL' as StepType, approverType: 'DEPARTMENT_HEAD' as ApproverType, slaHours: 72, allowDelegation: true },
      { stepId: 'S2', name: 'HR Review', order: 2, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 72, allowDelegation: true },
      { stepId: 'S3', name: 'Check Grade Change', order: 3, type: 'CONDITION' as StepType, condition: { field: 'gradeChange', operator: 'GREATER', value: 1, trueStepId: 'S4', falseStepId: 'S5' }, allowDelegation: false },
      { stepId: 'S4', name: 'CEO Approval', order: 4, type: 'APPROVAL' as StepType, approverType: 'ROLE' as ApproverType, slaHours: 120, allowDelegation: true },
      { stepId: 'S5', name: 'Finance Budget Check', order: 5, type: 'APPROVAL' as StepType, approverType: 'FINANCE' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S6', name: 'Process Promotion', order: 6, type: 'ACTION' as StepType, action: { type: 'UPDATE_STATUS', config: { status: 'PROMOTED' } }, allowDelegation: false },
      { stepId: 'S7', name: 'Notify Employee', order: 7, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER', message: 'Congratulations! Your promotion has been approved' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'APPROVED' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'REJECTED' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 9. Asset Request ───────────────────────────────────────────────── */
  {
    workflowId: 'WF-009', name: 'Asset Request', nameAr: 'طلب أصول', module: 'assets', triggerEvent: 'asset.requested',
    steps: [
      { stepId: 'S1', name: 'Manager Approval', order: 1, type: 'APPROVAL' as StepType, approverType: 'DIRECT_MANAGER' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S2', name: 'Check Value', order: 2, type: 'CONDITION' as StepType, condition: { field: 'value', operator: 'GREATER', value: 2000, trueStepId: 'S3', falseStepId: 'S4' }, allowDelegation: false },
      { stepId: 'S3', name: 'Finance Approval', order: 3, type: 'APPROVAL' as StepType, approverType: 'FINANCE' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S4', name: 'IT/Admin Assignment', order: 4, type: 'ACTION' as StepType, action: { type: 'CREATE_RECORD', config: { collection: 'asset_assignments', status: 'ASSIGNED' } }, allowDelegation: false },
      { stepId: 'S5', name: 'Notify Employee', order: 5, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER', message: 'Your asset request has been fulfilled' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'FULFILLED' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'REJECTED' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 10. Onboarding ─────────────────────────────────────────────────── */
  {
    workflowId: 'WF-010', name: 'Employee Onboarding', nameAr: 'تهيئة موظف جديد', module: 'onboarding', triggerEvent: 'employee.hired',
    steps: [
      { stepId: 'S1', name: 'HR Document Verification', order: 1, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S2', name: 'IT Account Setup', order: 2, type: 'ACTION' as StepType, action: { type: 'CREATE_RECORD', config: { collection: 'it_requests', type: 'ACCOUNT_SETUP' } }, allowDelegation: false },
      { stepId: 'S3', name: 'Asset Provisioning', order: 3, type: 'ACTION' as StepType, action: { type: 'CREATE_RECORD', config: { collection: 'asset_requests', type: 'NEW_HIRE' } }, allowDelegation: false },
      { stepId: 'S4', name: 'Manager Welcome', order: 4, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'DIRECT_MANAGER', message: 'New employee is ready to start' } }, allowDelegation: false },
      { stepId: 'S5', name: 'Complete Onboarding', order: 5, type: 'ACTION' as StepType, action: { type: 'UPDATE_STATUS', config: { status: 'ONBOARDED' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'ACTIVE' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'PENDING' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 11. Disciplinary Action ────────────────────────────────────────── */
  {
    workflowId: 'WF-011', name: 'Disciplinary Action', nameAr: 'إجراء تأديبي', module: 'disciplinary', triggerEvent: 'disciplinary.initiated',
    steps: [
      { stepId: 'S1', name: 'Department Head Review', order: 1, type: 'APPROVAL' as StepType, approverType: 'DEPARTMENT_HEAD' as ApproverType, slaHours: 48, allowDelegation: false },
      { stepId: 'S2', name: 'HR Investigation', order: 2, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 120, allowDelegation: false },
      { stepId: 'S3', name: 'Check Severity', order: 3, type: 'CONDITION' as StepType, condition: { field: 'severity', operator: 'GREATER', value: 2, trueStepId: 'S4', falseStepId: 'S5' }, allowDelegation: false },
      { stepId: 'S4', name: 'Legal Review', order: 4, type: 'APPROVAL' as StepType, approverType: 'ROLE' as ApproverType, slaHours: 72, allowDelegation: false },
      { stepId: 'S5', name: 'Issue Action', order: 5, type: 'ACTION' as StepType, action: { type: 'UPDATE_STATUS', config: { status: 'ACTION_ISSUED' } }, allowDelegation: false },
      { stepId: 'S6', name: 'Notify Employee', order: 6, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'SUBJECT', message: 'A disciplinary action has been issued' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'COMPLETED' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'DISMISSED' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 12. Grievance ──────────────────────────────────────────────────── */
  {
    workflowId: 'WF-012', name: 'Grievance', nameAr: 'شكوى', module: 'grievances', triggerEvent: 'grievance.submitted',
    steps: [
      { stepId: 'S1', name: 'HR Acknowledgement', order: 1, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 24, allowDelegation: false },
      { stepId: 'S2', name: 'Investigation', order: 2, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 168, allowDelegation: false },
      { stepId: 'S3', name: 'Resolution Decision', order: 3, type: 'APPROVAL' as StepType, approverType: 'DEPARTMENT_HEAD' as ApproverType, slaHours: 72, allowDelegation: true },
      { stepId: 'S4', name: 'Implement Resolution', order: 4, type: 'ACTION' as StepType, action: { type: 'UPDATE_STATUS', config: { status: 'RESOLVED' } }, allowDelegation: false },
      { stepId: 'S5', name: 'Notify Parties', order: 5, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER', message: 'Your grievance has been resolved' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'RESOLVED' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'CLOSED' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 13. Insurance Request ──────────────────────────────────────────── */
  {
    workflowId: 'WF-013', name: 'Insurance Request', nameAr: 'طلب تأمين', module: 'insurance', triggerEvent: 'insurance.requested',
    steps: [
      { stepId: 'S1', name: 'HR Verification', order: 1, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S2', name: 'Check Coverage Type', order: 2, type: 'CONDITION' as StepType, condition: { field: 'coverageType', operator: 'EQUALS', value: 'FAMILY', trueStepId: 'S3', falseStepId: 'S4' }, allowDelegation: false },
      { stepId: 'S3', name: 'Finance Approval', order: 3, type: 'APPROVAL' as StepType, approverType: 'FINANCE' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S4', name: 'Process Insurance', order: 4, type: 'ACTION' as StepType, action: { type: 'CREATE_RECORD', config: { collection: 'insurance_policies', status: 'ACTIVE' } }, allowDelegation: false },
      { stepId: 'S5', name: 'Notify Employee', order: 5, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER', message: 'Your insurance request has been processed' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'ACTIVE' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'REJECTED' } },
    status: 'ACTIVE', version: 1,
  },
  /* ── 14. Contract Renewal ───────────────────────────────────────────── */
  {
    workflowId: 'WF-014', name: 'Contract Renewal', nameAr: 'تجديد عقد', module: 'contracts', triggerEvent: 'contract.expiring',
    steps: [
      { stepId: 'S1', name: 'Manager Recommendation', order: 1, type: 'APPROVAL' as StepType, approverType: 'DIRECT_MANAGER' as ApproverType, slaHours: 72, allowDelegation: true },
      { stepId: 'S2', name: 'HR Review', order: 2, type: 'APPROVAL' as StepType, approverType: 'HR' as ApproverType, slaHours: 72, allowDelegation: true },
      { stepId: 'S3', name: 'Check Salary Adjustment', order: 3, type: 'CONDITION' as StepType, condition: { field: 'salaryChange', operator: 'GREATER', value: 0, trueStepId: 'S4', falseStepId: 'S5' }, allowDelegation: false },
      { stepId: 'S4', name: 'Finance Approval', order: 4, type: 'APPROVAL' as StepType, approverType: 'FINANCE' as ApproverType, slaHours: 48, allowDelegation: true },
      { stepId: 'S5', name: 'Generate Contract', order: 5, type: 'ACTION' as StepType, action: { type: 'CREATE_RECORD', config: { collection: 'contracts', status: 'RENEWED' } }, allowDelegation: false },
      { stepId: 'S6', name: 'Notify Employee', order: 6, type: 'NOTIFICATION' as StepType, action: { type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER', message: 'Your contract renewal has been processed' } }, allowDelegation: false },
    ],
    onComplete: { action: 'UPDATE_STATUS', config: { status: 'RENEWED' } },
    onReject: { action: 'UPDATE_STATUS', config: { status: 'NOT_RENEWED' } },
    status: 'ACTIVE', version: 1,
  },
];

const SEED_INSTANCES = [
  {
    instanceId: 'WFI-001', workflowId: 'WF-001', workflowName: 'Leave Approval',
    triggeredBy: 'EMP-001', triggeredByName: 'Ahmed Hassan', sourceModule: 'leaves', sourceId: 'LV-2026-001',
    currentStepId: 'S3', currentStepName: 'Department Head Approval',
    stepHistory: [
      { stepId: 'S1', stepName: 'Check Duration', assignedTo: 'SYSTEM', assignedToName: 'System', action: 'AUTO' as StepAction, timestamp: new Date(2026, 1, 10, 9, 0), slaBreached: false },
      { stepId: 'S2', stepName: 'Direct Manager Approval', assignedTo: 'EMP-050', assignedToName: 'Manager Ali', action: 'APPROVED' as StepAction, notes: 'Approved', timestamp: new Date(2026, 1, 10, 14, 0), slaBreached: false },
    ],
    status: 'IN_PROGRESS' as InstanceStatus, startedAt: new Date(2026, 1, 10, 9, 0),
  },
  {
    instanceId: 'WFI-002', workflowId: 'WF-002', workflowName: 'Loan Request',
    triggeredBy: 'EMP-010', triggeredByName: 'Sara Al-Dosari', sourceModule: 'loans', sourceId: 'LN-2026-001',
    currentStepId: 'S4', currentStepName: 'Process Loan',
    stepHistory: [
      { stepId: 'S1', stepName: 'HR Review', assignedTo: 'EMP-003', assignedToName: 'HR Specialist', action: 'APPROVED' as StepAction, timestamp: new Date(2026, 1, 8, 10, 0), slaBreached: false },
      { stepId: 'S2', stepName: 'Check Amount', assignedTo: 'SYSTEM', assignedToName: 'System', action: 'AUTO' as StepAction, timestamp: new Date(2026, 1, 8, 10, 1), slaBreached: false },
      { stepId: 'S3', stepName: 'Finance Approval', assignedTo: 'EMP-020', assignedToName: 'Finance Officer', action: 'APPROVED' as StepAction, timestamp: new Date(2026, 1, 9, 11, 0), slaBreached: false },
    ],
    status: 'IN_PROGRESS' as InstanceStatus, startedAt: new Date(2026, 1, 8, 10, 0),
  },
];

export async function ensureSeedData(db: Db, tenantId: string) {
  const coll = db.collection(TEMPLATES_COLL);
  const existingCount = await coll.countDocuments({ tenantId });
  const now = new Date();

  if (existingCount === 0) {
    // Fresh tenant – insert everything
    await coll.insertMany(SEED_TEMPLATES.map(t => ({ ...t, tenantId, createdAt: now, updatedAt: now })));
    await db.collection(INSTANCES_COLL).insertMany(SEED_INSTANCES.map(i => ({ ...i, tenantId })));
  } else {
    // Existing tenant – insert any NEW templates that don't exist yet
    const existingIds = (await coll.find({ tenantId }, { projection: { workflowId: 1 } }).toArray()).map(d => d.workflowId);
    const missing = SEED_TEMPLATES.filter(t => !existingIds.includes(t.workflowId));
    if (missing.length > 0) {
      await coll.insertMany(missing.map(t => ({ ...t, tenantId, createdAt: now, updatedAt: now })));
    }
  }
}

/* ── Template Queries ──────────────────────────────────────────────── */

export async function listTemplates(db: Db, tenantId: string, status?: string) {
  const query: any = { tenantId };
  if (status) query.status = status;
  return db.collection(TEMPLATES_COLL).find(query).sort({ workflowId: 1 }).toArray();
}

export async function getTemplateDetail(db: Db, tenantId: string, workflowId: string) {
  return db.collection(TEMPLATES_COLL).findOne({ tenantId, workflowId });
}

/* ── Instance Queries ──────────────────────────────────────────────── */

export async function listInstances(db: Db, tenantId: string, filters?: { workflowId?: string; status?: string }) {
  const query: any = { tenantId };
  if (filters?.workflowId) query.workflowId = filters.workflowId;
  if (filters?.status) query.status = filters.status;
  return db.collection(INSTANCES_COLL).find(query).sort({ startedAt: -1 }).toArray();
}

export async function getMyPending(db: Db, tenantId: string, userId: string) {
  const instances = await db.collection(INSTANCES_COLL).find({ tenantId, status: 'IN_PROGRESS' }).toArray();
  return instances.filter(i => {
    const template = SEED_TEMPLATES.find(t => t.workflowId === i.workflowId);
    if (!template) return false;
    const currentStep = template.steps.find(s => s.stepId === i.currentStepId);
    return currentStep?.type === 'APPROVAL';
  });
}

export async function getSLAReport(db: Db, tenantId: string) {
  const instances = await db.collection(INSTANCES_COLL).find({ tenantId }).limit(5000).toArray();
  let totalSteps = 0, breached = 0, avgDuration = 0;
  const completedInstances = instances.filter(i => i.completedAt);
  for (const i of instances) {
    for (const s of i.stepHistory || []) {
      totalSteps++;
      if (s.slaBreached) breached++;
    }
  }
  if (completedInstances.length > 0) {
    avgDuration = completedInstances.reduce((s, i) => s + (i.totalDuration || 0), 0) / completedInstances.length;
  }
  return { totalInstances: instances.length, totalSteps, slaBreaches: breached, slaComplianceRate: totalSteps > 0 ? Math.round(((totalSteps - breached) / totalSteps) * 100) : 100, avgDurationHours: Math.round(avgDuration * 10) / 10 };
}

export async function getBottleneckAnalysis(db: Db, tenantId: string) {
  const instances = await db.collection(INSTANCES_COLL).find({ tenantId, status: 'IN_PROGRESS' }).toArray();
  const stepCounts: any = {};
  for (const i of instances) {
    const key = `${i.workflowName} → ${i.currentStepName}`;
    stepCounts[key] = (stepCounts[key] || 0) + 1;
  }
  return Object.entries(stepCounts).map(([step, count]) => ({ step, count })).sort((a: any, b: any) => b.count - a.count);
}

/* ── Mutations ─────────────────────────────────────────────────────── */

export async function createTemplate(db: Db, tenantId: string, data: any) {
  const count = await db.collection(TEMPLATES_COLL).countDocuments({ tenantId });
  const workflowId = `WF-${String(count + 1).padStart(3, '0')}`;
  const now = new Date();
  await db.collection(TEMPLATES_COLL).insertOne({
    ...data, tenantId, workflowId, status: 'DRAFT', version: 1, createdAt: now, updatedAt: now,
  });
  return workflowId;
}

export async function updateTemplate(db: Db, tenantId: string, workflowId: string, updates: any) {
  await db.collection(TEMPLATES_COLL).updateOne(
    { tenantId, workflowId },
    { $set: { ...updates, updatedAt: new Date() }, $inc: { version: 1 } },
  );
}

export async function startInstance(db: Db, tenantId: string, data: { workflowId: string; triggeredBy: string; triggeredByName: string; sourceModule: string; sourceId: string }) {
  const template = await db.collection(TEMPLATES_COLL).findOne({ tenantId, workflowId: data.workflowId });
  if (!template) throw new Error('Workflow template not found');
  const count = await db.collection(INSTANCES_COLL).countDocuments({ tenantId });
  const instanceId = `WFI-${String(count + 1).padStart(3, '0')}`;
  const firstStep = template.steps[0];
  const now = new Date();
  await db.collection(INSTANCES_COLL).insertOne({
    tenantId, instanceId, workflowId: data.workflowId, workflowName: template.name,
    triggeredBy: data.triggeredBy, triggeredByName: data.triggeredByName,
    sourceModule: data.sourceModule, sourceId: data.sourceId,
    currentStepId: firstStep.stepId, currentStepName: firstStep.name,
    stepHistory: [], status: 'IN_PROGRESS', startedAt: now,
  });
  return instanceId;
}

export async function approveStep(db: Db, tenantId: string, instanceId: string, userId: string, userName: string, notes?: string, userRoles?: string[]) {
  const instance = await db.collection(INSTANCES_COLL).findOne({ tenantId, instanceId });
  if (!instance) throw new Error('Instance not found');

  // Self-approval prevention: the user who triggered/requested the workflow
  // must not be able to approve any step within their own request.
  if (instance.triggeredBy === userId) {
    throw new Error('Self-approval is not permitted: you cannot approve a workflow you initiated');
  }

  const template = await db.collection(TEMPLATES_COLL).findOne({ tenantId, workflowId: instance.workflowId });
  if (!template) throw new Error('Template not found');

  const currentStep = template.steps.find((s: any) => s.stepId === instance.currentStepId);
  if (!currentStep) throw new Error('Current workflow step not found in template');

  // Only APPROVAL-type steps can be approved by a user; non-approval steps are
  // handled automatically by the workflow engine.
  if (currentStep.type !== 'APPROVAL') {
    throw new Error(`Step "${currentStep.name}" is of type "${currentStep.type}" and cannot be manually approved`);
  }

  // Verify the acting user holds the required approver role for this step.
  // SPECIFIC_USER steps carry an explicit allowedApprovers list on the step;
  // role-based steps are matched against the caller's roles array.
  const approverType: ApproverType = currentStep.approverType;
  const roles = userRoles ?? [];

  const APPROVER_ROLE_MAP: Record<string, string[]> = {
    HR:               ['hr', 'hr_manager', 'hr_admin'],
    FINANCE:          ['finance', 'finance_manager', 'finance_officer'],
    DEPARTMENT_HEAD:  ['department_head', 'dept_head'],
    DIRECT_MANAGER:   ['manager', 'direct_manager', 'supervisor'],
    ROLE:             currentStep.allowedRoles ?? [],   // per-step custom roles
  };

  let isAuthorized = false;

  if (approverType === 'SPECIFIC_USER') {
    // Step must explicitly list this user in allowedApprovers
    const allowedApprovers: string[] = currentStep.allowedApprovers ?? [];
    isAuthorized = allowedApprovers.includes(userId);
  } else if (approverType === 'DYNAMIC') {
    // DYNAMIC steps resolve the approver at runtime (e.g. stored on the instance).
    const runtimeApprover: string = instance.assignedApprover ?? '';
    isAuthorized = runtimeApprover === userId;
  } else {
    const requiredRoles = APPROVER_ROLE_MAP[approverType] ?? [];
    isAuthorized = roles.some(r => requiredRoles.includes(r.toLowerCase()));
  }

  if (!isAuthorized) {
    throw new Error(
      `Unauthorized: your role does not permit approving a "${currentStep.name}" step (requires approver type: ${approverType})`
    );
  }

  const currentIdx = template.steps.findIndex((s: any) => s.stepId === instance.currentStepId);
  const nextStep = template.steps[currentIdx + 1];

  const historyEntry = {
    stepId: instance.currentStepId, stepName: instance.currentStepName,
    assignedTo: userId, assignedToName: userName, action: 'APPROVED' as StepAction,
    notes, timestamp: new Date(), slaBreached: false,
  };

  if (!nextStep) {
    await db.collection(INSTANCES_COLL).updateOne(
      { tenantId, instanceId },
      { $set: { status: 'COMPLETED', completedAt: new Date() }, $push: { stepHistory: historyEntry } as Record<string, unknown> },
    );
  } else {
    await db.collection(INSTANCES_COLL).updateOne(
      { tenantId, instanceId },
      { $set: { currentStepId: nextStep.stepId, currentStepName: nextStep.name }, $push: { stepHistory: historyEntry } as Record<string, unknown> },
    );
  }
}

export async function rejectStep(db: Db, tenantId: string, instanceId: string, userId: string, userName: string, notes?: string, userRoles?: string[]) {
  const instance = await db.collection(INSTANCES_COLL).findOne({ tenantId, instanceId });
  if (!instance) throw new Error('Instance not found');

  // Self-rejection prevention: the requester cannot reject their own workflow.
  if (instance.triggeredBy === userId) {
    throw new Error('Self-rejection is not permitted: you cannot reject a workflow you initiated');
  }

  const template = await db.collection(TEMPLATES_COLL).findOne({ tenantId, workflowId: instance.workflowId });
  if (!template) throw new Error('Template not found');

  const currentStep = template.steps.find((s: any) => s.stepId === instance.currentStepId);
  if (!currentStep) throw new Error('Current workflow step not found in template');

  if (currentStep.type !== 'APPROVAL') {
    throw new Error(`Step "${currentStep.name}" is of type "${currentStep.type}" and cannot be manually rejected`);
  }

  // Reuse the same role-based authorization logic as approveStep.
  const approverType: ApproverType = currentStep.approverType;
  const roles = userRoles ?? [];

  const APPROVER_ROLE_MAP: Record<string, string[]> = {
    HR:               ['hr', 'hr_manager', 'hr_admin'],
    FINANCE:          ['finance', 'finance_manager', 'finance_officer'],
    DEPARTMENT_HEAD:  ['department_head', 'dept_head'],
    DIRECT_MANAGER:   ['manager', 'direct_manager', 'supervisor'],
    ROLE:             currentStep.allowedRoles ?? [],
  };

  let isAuthorized = false;

  if (approverType === 'SPECIFIC_USER') {
    const allowedApprovers: string[] = currentStep.allowedApprovers ?? [];
    isAuthorized = allowedApprovers.includes(userId);
  } else if (approverType === 'DYNAMIC') {
    const runtimeApprover: string = instance.assignedApprover ?? '';
    isAuthorized = runtimeApprover === userId;
  } else {
    const requiredRoles = APPROVER_ROLE_MAP[approverType] ?? [];
    isAuthorized = roles.some(r => requiredRoles.includes(r.toLowerCase()));
  }

  if (!isAuthorized) {
    throw new Error(
      `Unauthorized: your role does not permit rejecting a "${currentStep.name}" step (requires approver type: ${approverType})`
    );
  }

  const historyEntry = {
    stepId: instance.currentStepId, stepName: instance.currentStepName,
    assignedTo: userId, assignedToName: userName, action: 'REJECTED' as StepAction,
    notes, timestamp: new Date(), slaBreached: false,
  };
  await db.collection(INSTANCES_COLL).updateOne(
    { tenantId, instanceId },
    { $set: { status: 'REJECTED' }, $push: { stepHistory: historyEntry } as Record<string, unknown> },
  );
}

export async function cancelInstance(db: Db, tenantId: string, instanceId: string) {
  await db.collection(INSTANCES_COLL).updateOne({ tenantId, instanceId }, { $set: { status: 'CANCELLED' } });
}
