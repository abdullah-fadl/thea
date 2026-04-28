import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';

export const dynamic = 'force-dynamic';

const DEFAULT_WORKFLOWS = [
  /* ── 1. Leave Approval ── */
  { name: 'Leave Approval', nameAr: 'اعتماد الإجازة', triggerType: 'LEAVE', steps: [
    { stepNumber: 1, type: 'CONDITION', name: 'Check Duration', nameAr: 'فحص المدة', condition: { field: 'days', operator: 'GT', value: 5, trueStep: 3, falseStep: 2 } },
    { stepNumber: 2, type: 'APPROVAL', name: 'Direct Manager Approval', nameAr: 'موافقة المدير المباشر', assigneeType: 'DIRECT_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 3, type: 'APPROVAL', name: 'Department Head Approval', nameAr: 'موافقة رئيس القسم', assigneeType: 'DEPARTMENT_HEAD', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 4, type: 'CONDITION', name: 'Check Extended Leave', nameAr: 'فحص الإجازة الطويلة', condition: { field: 'days', operator: 'GT', value: 15, trueStep: 5, falseStep: 6 } },
    { stepNumber: 5, type: 'APPROVAL', name: 'HR Approval', nameAr: 'موافقة الموارد البشرية', assigneeType: 'HR_MANAGER', slaHours: 24, escalationAction: 'ESCALATE' },
    { stepNumber: 6, type: 'ACTION', name: 'Update Status', nameAr: 'تحديث الحالة', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'leaves', field: 'status', value: 'APPROVED' } }] },
    { stepNumber: 7, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 2. Loan Request ── */
  { name: 'Loan Request', nameAr: 'طلب سلفة', triggerType: 'LOAN', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'HR Review', nameAr: 'مراجعة HR', assigneeType: 'HR_MANAGER', slaHours: 72, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'CONDITION', name: 'Check Amount', nameAr: 'فحص المبلغ', condition: { field: 'amount', operator: 'GT', value: 10000, trueStep: 3, falseStep: 4 } },
    { stepNumber: 3, type: 'APPROVAL', name: 'Finance Approval', nameAr: 'موافقة المالية', assigneeType: 'FINANCE_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 4, type: 'ACTION', name: 'Process Loan', nameAr: 'معالجة السلفة', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'loans', field: 'status', value: 'APPROVED' } }] },
    { stepNumber: 5, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 3. Purchase Request ── */
  { name: 'Purchase Request', nameAr: 'طلب شراء', triggerType: 'PURCHASE', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'Manager Approval', nameAr: 'موافقة المدير', assigneeType: 'DIRECT_MANAGER', slaHours: 24, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'CONDITION', name: 'Budget Check', nameAr: 'فحص الميزانية', condition: { field: 'amount', operator: 'GT', value: 5000, trueStep: 3, falseStep: 4 } },
    { stepNumber: 3, type: 'APPROVAL', name: 'Finance Approval', nameAr: 'موافقة المالية', assigneeType: 'FINANCE_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 4, type: 'ACTION', name: 'Create PO', nameAr: 'إنشاء أمر الشراء', actions: [{ type: 'CREATE_RECORD', config: { collection: 'purchase_orders' } }] },
  ]},
  /* ── 4. Travel Request ── */
  { name: 'Travel Request', nameAr: 'طلب سفر', triggerType: 'TRAVEL', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'Manager Approval', nameAr: 'موافقة المدير', assigneeType: 'DIRECT_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'CONDITION', name: 'Check Budget', nameAr: 'فحص التكلفة', condition: { field: 'estimatedCost', operator: 'GT', value: 5000, trueStep: 3, falseStep: 4 } },
    { stepNumber: 3, type: 'APPROVAL', name: 'Finance Approval', nameAr: 'موافقة المالية', assigneeType: 'FINANCE_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 4, type: 'APPROVAL', name: 'HR Acknowledgement', nameAr: 'إقرار HR', assigneeType: 'HR_MANAGER', slaHours: 24, escalationAction: 'AUTO_APPROVE' },
    { stepNumber: 5, type: 'ACTION', name: 'Approve Travel', nameAr: 'اعتماد السفر', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'travel', field: 'status', value: 'APPROVED' } }] },
    { stepNumber: 6, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 5. Letter Request ── */
  { name: 'Letter Request', nameAr: 'طلب خطاب', triggerType: 'LETTER', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'HR Review', nameAr: 'مراجعة HR', assigneeType: 'HR_MANAGER', slaHours: 24, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'ACTION', name: 'Generate Letter', nameAr: 'إنشاء الخطاب', actions: [{ type: 'CREATE_RECORD', config: { collection: 'letters', status: 'GENERATED' } }] },
    { stepNumber: 3, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 6. Resignation ── */
  { name: 'Resignation', nameAr: 'استقالة', triggerType: 'RESIGNATION', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'Manager Approval', nameAr: 'موافقة المدير', assigneeType: 'DIRECT_MANAGER', slaHours: 72, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'APPROVAL', name: 'Department Head Approval', nameAr: 'موافقة رئيس القسم', assigneeType: 'DEPARTMENT_HEAD', slaHours: 72, escalationAction: 'ESCALATE' },
    { stepNumber: 3, type: 'APPROVAL', name: 'HR Admin Approval', nameAr: 'موافقة إدارة HR', assigneeType: 'HR_ADMIN', slaHours: 120, escalationAction: 'ESCALATE' },
    { stepNumber: 4, type: 'ACTION', name: 'Process Resignation', nameAr: 'معالجة الاستقالة', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'employees', field: 'status', value: 'RESIGNED' } }] },
    { stepNumber: 5, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 7. Training Request ── */
  { name: 'Training Request', nameAr: 'طلب تدريب', triggerType: 'TRAINING', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'Manager Approval', nameAr: 'موافقة المدير', assigneeType: 'DIRECT_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'APPROVAL', name: 'HR Review', nameAr: 'مراجعة HR', assigneeType: 'HR_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 3, type: 'CONDITION', name: 'Check Cost', nameAr: 'فحص التكلفة', condition: { field: 'cost', operator: 'GT', value: 3000, trueStep: 4, falseStep: 5 } },
    { stepNumber: 4, type: 'APPROVAL', name: 'Finance Approval', nameAr: 'موافقة المالية', assigneeType: 'FINANCE_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 5, type: 'ACTION', name: 'Enroll Employee', nameAr: 'تسجيل الموظف', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'training', field: 'status', value: 'ENROLLED' } }] },
    { stepNumber: 6, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 8. Promotion Request ── */
  { name: 'Promotion Request', nameAr: 'طلب ترقية', triggerType: 'PROMOTION', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'Department Head Review', nameAr: 'مراجعة رئيس القسم', assigneeType: 'DEPARTMENT_HEAD', slaHours: 72, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'APPROVAL', name: 'HR Review', nameAr: 'مراجعة HR', assigneeType: 'HR_MANAGER', slaHours: 72, escalationAction: 'ESCALATE' },
    { stepNumber: 3, type: 'CONDITION', name: 'Check Grade Change', nameAr: 'فحص تغيير الدرجة', condition: { field: 'gradeChange', operator: 'GT', value: 1, trueStep: 4, falseStep: 5 } },
    { stepNumber: 4, type: 'APPROVAL', name: 'CEO Approval', nameAr: 'موافقة المدير العام', assigneeType: 'CEO', slaHours: 120, escalationAction: 'ESCALATE' },
    { stepNumber: 5, type: 'APPROVAL', name: 'Finance Budget Check', nameAr: 'فحص ميزانية المالية', assigneeType: 'FINANCE_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 6, type: 'ACTION', name: 'Process Promotion', nameAr: 'معالجة الترقية', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'promotions', field: 'status', value: 'APPROVED' } }] },
    { stepNumber: 7, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 9. Asset Request ── */
  { name: 'Asset Request', nameAr: 'طلب أصول', triggerType: 'ASSET', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'Manager Approval', nameAr: 'موافقة المدير', assigneeType: 'DIRECT_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'CONDITION', name: 'Check Value', nameAr: 'فحص القيمة', condition: { field: 'value', operator: 'GT', value: 2000, trueStep: 3, falseStep: 4 } },
    { stepNumber: 3, type: 'APPROVAL', name: 'Finance Approval', nameAr: 'موافقة المالية', assigneeType: 'FINANCE_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 4, type: 'ACTION', name: 'Assign Asset', nameAr: 'تسليم الأصل', actions: [{ type: 'CREATE_RECORD', config: { collection: 'asset_assignments', status: 'ASSIGNED' } }] },
    { stepNumber: 5, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 10. Employee Onboarding ── */
  { name: 'Employee Onboarding', nameAr: 'تهيئة موظف جديد', triggerType: 'ONBOARDING', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'HR Document Verification', nameAr: 'التحقق من الوثائق', assigneeType: 'HR_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'ACTION', name: 'IT Account Setup', nameAr: 'إعداد حساب تقنية', actions: [{ type: 'CREATE_RECORD', config: { collection: 'it_requests', type: 'ACCOUNT_SETUP' } }] },
    { stepNumber: 3, type: 'ACTION', name: 'Asset Provisioning', nameAr: 'توفير الأصول', actions: [{ type: 'CREATE_RECORD', config: { collection: 'asset_requests', type: 'NEW_HIRE' } }] },
    { stepNumber: 4, type: 'NOTIFICATION', name: 'Manager Welcome', nameAr: 'ترحيب المدير', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'DIRECT_MANAGER' } }] },
    { stepNumber: 5, type: 'ACTION', name: 'Complete Onboarding', nameAr: 'اكتمال التهيئة', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'employees', field: 'status', value: 'ACTIVE' } }] },
  ]},
  /* ── 11. Disciplinary Action ── */
  { name: 'Disciplinary Action', nameAr: 'إجراء تأديبي', triggerType: 'DISCIPLINARY', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'Department Head Review', nameAr: 'مراجعة رئيس القسم', assigneeType: 'DEPARTMENT_HEAD', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'APPROVAL', name: 'HR Investigation', nameAr: 'تحقيق HR', assigneeType: 'HR_MANAGER', slaHours: 120, escalationAction: 'ESCALATE' },
    { stepNumber: 3, type: 'CONDITION', name: 'Check Severity', nameAr: 'فحص الخطورة', condition: { field: 'severity', operator: 'GT', value: 2, trueStep: 4, falseStep: 5 } },
    { stepNumber: 4, type: 'APPROVAL', name: 'Legal Review', nameAr: 'مراجعة قانونية', assigneeType: 'HR_ADMIN', slaHours: 72, escalationAction: 'ESCALATE' },
    { stepNumber: 5, type: 'ACTION', name: 'Issue Action', nameAr: 'إصدار الإجراء', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'disciplinary', field: 'status', value: 'ACTION_ISSUED' } }] },
    { stepNumber: 6, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'SUBJECT' } }] },
  ]},
  /* ── 12. Grievance ── */
  { name: 'Grievance', nameAr: 'شكوى', triggerType: 'GRIEVANCE', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'HR Acknowledgement', nameAr: 'إقرار HR', assigneeType: 'HR_MANAGER', slaHours: 24, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'APPROVAL', name: 'Investigation', nameAr: 'التحقيق', assigneeType: 'HR_MANAGER', slaHours: 168, escalationAction: 'ESCALATE' },
    { stepNumber: 3, type: 'APPROVAL', name: 'Resolution Decision', nameAr: 'قرار الحل', assigneeType: 'DEPARTMENT_HEAD', slaHours: 72, escalationAction: 'ESCALATE' },
    { stepNumber: 4, type: 'ACTION', name: 'Implement Resolution', nameAr: 'تنفيذ القرار', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'grievances', field: 'status', value: 'RESOLVED' } }] },
    { stepNumber: 5, type: 'NOTIFICATION', name: 'Notify Parties', nameAr: 'إشعار الأطراف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 13. Insurance Request ── */
  { name: 'Insurance Request', nameAr: 'طلب تأمين', triggerType: 'INSURANCE', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'HR Verification', nameAr: 'تحقق HR', assigneeType: 'HR_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'CONDITION', name: 'Check Coverage Type', nameAr: 'فحص نوع التغطية', condition: { field: 'coverageType', operator: 'EQ', value: 'FAMILY', trueStep: 3, falseStep: 4 } },
    { stepNumber: 3, type: 'APPROVAL', name: 'Finance Approval', nameAr: 'موافقة المالية', assigneeType: 'FINANCE_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 4, type: 'ACTION', name: 'Process Insurance', nameAr: 'معالجة التأمين', actions: [{ type: 'CREATE_RECORD', config: { collection: 'insurance_policies', status: 'ACTIVE' } }] },
    { stepNumber: 5, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 14. Contract Renewal ── */
  { name: 'Contract Renewal', nameAr: 'تجديد عقد', triggerType: 'CONTRACT', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'Manager Recommendation', nameAr: 'توصية المدير', assigneeType: 'DIRECT_MANAGER', slaHours: 72, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'APPROVAL', name: 'HR Review', nameAr: 'مراجعة HR', assigneeType: 'HR_MANAGER', slaHours: 72, escalationAction: 'ESCALATE' },
    { stepNumber: 3, type: 'CONDITION', name: 'Check Salary Adjustment', nameAr: 'فحص تعديل الراتب', condition: { field: 'salaryChange', operator: 'GT', value: 0, trueStep: 4, falseStep: 5 } },
    { stepNumber: 4, type: 'APPROVAL', name: 'Finance Approval', nameAr: 'موافقة المالية', assigneeType: 'FINANCE_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 5, type: 'ACTION', name: 'Generate Contract', nameAr: 'إنشاء العقد', actions: [{ type: 'CREATE_RECORD', config: { collection: 'contracts', status: 'RENEWED' } }] },
    { stepNumber: 6, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 15. Overtime Request ── */
  { name: 'Overtime Request', nameAr: 'طلب عمل إضافي', triggerType: 'OVERTIME', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'Direct Manager Approval', nameAr: 'موافقة المدير المباشر', assigneeType: 'DIRECT_MANAGER', slaHours: 24, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'CONDITION', name: 'Check Hours', nameAr: 'فحص الساعات', condition: { field: 'hours', operator: 'GT', value: 4, trueStep: 3, falseStep: 4 } },
    { stepNumber: 3, type: 'APPROVAL', name: 'Department Head Approval', nameAr: 'موافقة رئيس القسم', assigneeType: 'DEPARTMENT_HEAD', slaHours: 24, escalationAction: 'ESCALATE' },
    { stepNumber: 4, type: 'APPROVAL', name: 'HR Verification', nameAr: 'تحقق الموارد البشرية', assigneeType: 'HR_MANAGER', slaHours: 24, escalationAction: 'AUTO_APPROVE' },
    { stepNumber: 5, type: 'CONDITION', name: 'Check Monthly Limit', nameAr: 'فحص الحد الشهري', condition: { field: 'monthlyTotal', operator: 'GT', value: 40, trueStep: 6, falseStep: 7 } },
    { stepNumber: 6, type: 'APPROVAL', name: 'Finance Approval', nameAr: 'موافقة المالية', assigneeType: 'FINANCE_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 7, type: 'ACTION', name: 'Record Overtime', nameAr: 'تسجيل العمل الإضافي', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'overtime', field: 'status', value: 'APPROVED' } }] },
    { stepNumber: 8, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 16. Shift Swap Request ── */
  { name: 'Shift Swap Request', nameAr: 'طلب تبديل شفت', triggerType: 'SHIFT_SWAP', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'Swap Partner Consent', nameAr: 'موافقة الزميل', assigneeType: 'SWAP_PARTNER', slaHours: 24, escalationAction: 'AUTO_REJECT' },
    { stepNumber: 2, type: 'APPROVAL', name: 'Direct Manager Approval', nameAr: 'موافقة المدير المباشر', assigneeType: 'DIRECT_MANAGER', slaHours: 24, escalationAction: 'ESCALATE' },
    { stepNumber: 3, type: 'CONDITION', name: 'Check Qualifications Match', nameAr: 'فحص تطابق المؤهلات', condition: { field: 'qualificationsMatch', operator: 'EQ', value: true, trueStep: 4, falseStep: 5 } },
    { stepNumber: 4, type: 'ACTION', name: 'Execute Swap', nameAr: 'تنفيذ التبديل', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'schedules', field: 'swapStatus', value: 'SWAPPED' } }] },
    { stepNumber: 5, type: 'APPROVAL', name: 'Department Head Override', nameAr: 'تجاوز رئيس القسم', assigneeType: 'DEPARTMENT_HEAD', slaHours: 24, escalationAction: 'AUTO_REJECT' },
    { stepNumber: 6, type: 'NOTIFICATION', name: 'Notify Both Employees', nameAr: 'إشعار الموظفين', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }, { type: 'SEND_NOTIFICATION', config: { to: 'SWAP_PARTNER' } }] },
  ]},
  /* ── 17. Business Trip Settlement ── */
  { name: 'Business Trip Settlement', nameAr: 'تسوية مصاريف السفر', triggerType: 'TRIP_SETTLEMENT', steps: [
    { stepNumber: 1, type: 'CONDITION', name: 'Check Receipts', nameAr: 'فحص الإيصالات', condition: { field: 'hasReceipts', operator: 'EQ', value: true, trueStep: 2, falseStep: 6 } },
    { stepNumber: 2, type: 'APPROVAL', name: 'Direct Manager Verification', nameAr: 'تحقق المدير المباشر', assigneeType: 'DIRECT_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 3, type: 'CONDITION', name: 'Check Amount', nameAr: 'فحص المبلغ', condition: { field: 'totalAmount', operator: 'GT', value: 5000, trueStep: 4, falseStep: 5 } },
    { stepNumber: 4, type: 'APPROVAL', name: 'Finance Director Approval', nameAr: 'موافقة مدير المالية', assigneeType: 'FINANCE_MANAGER', slaHours: 72, escalationAction: 'ESCALATE' },
    { stepNumber: 5, type: 'ACTION', name: 'Process Reimbursement', nameAr: 'صرف التعويض', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'trip_settlements', field: 'status', value: 'REIMBURSED' } }] },
    { stepNumber: 6, type: 'NOTIFICATION', name: 'Request Receipts', nameAr: 'طلب إيصالات', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER', template: 'MISSING_RECEIPTS' } }] },
    { stepNumber: 7, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
  /* ── 18. End of Service ── */
  { name: 'End of Service', nameAr: 'مخالصة نهاية خدمة', triggerType: 'END_OF_SERVICE', steps: [
    { stepNumber: 1, type: 'APPROVAL', name: 'HR Initiation', nameAr: 'بدء HR', assigneeType: 'HR_MANAGER', slaHours: 48, escalationAction: 'ESCALATE' },
    { stepNumber: 2, type: 'ACTION', name: 'Calculate Benefits', nameAr: 'احتساب المستحقات', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'end_of_service', field: 'calculationStatus', value: 'CALCULATED' } }] },
    { stepNumber: 3, type: 'APPROVAL', name: 'Finance Verification', nameAr: 'تحقق المالية', assigneeType: 'FINANCE_MANAGER', slaHours: 72, escalationAction: 'ESCALATE' },
    { stepNumber: 4, type: 'CONDITION', name: 'Check Amount', nameAr: 'فحص المبلغ', condition: { field: 'totalBenefits', operator: 'GT', value: 50000, trueStep: 5, falseStep: 6 } },
    { stepNumber: 5, type: 'APPROVAL', name: 'CEO Approval', nameAr: 'موافقة المدير العام', assigneeType: 'CEO', slaHours: 120, escalationAction: 'ESCALATE' },
    { stepNumber: 6, type: 'ACTION', name: 'IT Account Deactivation', nameAr: 'إلغاء حسابات تقنية', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'it_requests', field: 'type', value: 'DEACTIVATION' } }] },
    { stepNumber: 7, type: 'ACTION', name: 'Asset Recovery', nameAr: 'استرجاع الأصول', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'asset_requests', field: 'type', value: 'RECOVERY' } }] },
    { stepNumber: 8, type: 'ACTION', name: 'Process Final Payment', nameAr: 'صرف المخالصة', actions: [{ type: 'UPDATE_STATUS', config: { collection: 'end_of_service', field: 'status', value: 'SETTLED' } }] },
    { stepNumber: 9, type: 'NOTIFICATION', name: 'Notify Employee', nameAr: 'إشعار الموظف', actions: [{ type: 'SEND_NOTIFICATION', config: { to: 'REQUESTER' } }] },
  ]},
];

async function ensureDefaults(tenantId: string) {
  const col = await getCVisionCollection<any>(tenantId, 'workflows');
  const now = new Date();

  // Get all existing workflows (active & inactive) — check triggerType to avoid duplicates
  const existing = await col.find({ tenantId }, { projection: { triggerType: 1, isActive: 1, workflowId: 1 } }).limit(500).toArray();
  const existingTypes = new Set(existing.map((d: any) => d.triggerType));

  if (existing.length === 0) {
    // Fresh tenant – insert all defaults
    await col.insertMany(DEFAULT_WORKFLOWS.map(w => ({ ...w, tenantId, workflowId: uuidv4(), isActive: true, createdAt: now, updatedAt: now })));
  } else {
    // Existing tenant – add any new workflow types that don't exist yet
    const missing = DEFAULT_WORKFLOWS.filter(w => !existingTypes.has(w.triggerType));
    if (missing.length > 0) {
      await col.insertMany(missing.map(w => ({ ...w, tenantId, workflowId: uuidv4(), isActive: true, createdAt: now, updatedAt: now })));
    }

    // Deduplicate: if a triggerType has multiple docs, keep only the newest active one
    const typeCount: Record<string, any[]> = {};
    const allDocs = await col.find({ tenantId }, { projection: { triggerType: 1, isActive: 1, workflowId: 1, updatedAt: 1, createdAt: 1 } }).limit(500).toArray();
    for (const d of allDocs) {
      const key = d.triggerType || 'unknown';
      if (!typeCount[key]) typeCount[key] = [];
      typeCount[key].push(d);
    }
    const toDelete: string[] = [];
    for (const [type, docs] of Object.entries(typeCount)) {
      if (docs.length > 1) {
        // Sort: active first, then by updatedAt desc
        docs.sort((a: any, b: any) => {
          if (a.isActive && !b.isActive) return -1;
          if (!a.isActive && b.isActive) return 1;
          return (new Date(b.updatedAt || b.createdAt).getTime()) - (new Date(a.updatedAt || a.createdAt).getTime());
        });
        // Keep the first (best), mark rest for deletion
        for (let i = 1; i < docs.length; i++) {
          toDelete.push(docs[i].workflowId);
        }
      }
    }
    if (toDelete.length > 0) {
      await col.deleteMany({ tenantId, workflowId: { $in: toDelete } });
    }
  }
  return col;
}

function canWrite(ctx: any) {
  return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(CVISION_PERMISSIONS.WORKFLOWS_WRITE);
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const col = await ensureDefaults(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  if (action === 'list') {
    const includeInactive = searchParams.get('includeInactive') === '1';
    const filter: any = { tenantId, triggerType: { $exists: true } };
    if (!includeInactive) filter.isActive = { $ne: false };
    return NextResponse.json({ ok: true, data: await col.find(filter).sort({ createdAt: -1 }).limit(200).toArray() });
  }
  if (action === 'get') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    const doc = await col.findOne({ tenantId, workflowId: id });
    return NextResponse.json({ ok: true, data: doc });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.workflows.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!canWrite(ctx)) return deny('INSUFFICIENT_PERMISSION', 'Requires WORKFLOWS_WRITE');
  const col = await ensureDefaults(tenantId);
  const body = await request.json();
  const action = body.action;
  const auditCtx = createCVisionAuditContext({ userId: ctx.userId, role: ctx.roles[0] || 'unknown', tenantId, user: ctx.user }, request);

  if (action === 'create') {
    const doc = { tenantId, workflowId: uuidv4(), name: body.name || '', nameAr: body.nameAr || '', description: body.description || '', triggerType: body.triggerType || 'GENERAL', isActive: true, steps: body.steps || [], createdAt: new Date(), updatedAt: new Date() };
    await col.insertOne(doc);
    await logCVisionAudit(auditCtx, 'CREATE', 'authz', { resourceId: doc.workflowId, metadata: { type: 'workflow' } });
    return NextResponse.json({ ok: true, data: doc });
  }
  if (action === 'update') {
    const { workflowId, ...updates } = body; delete updates.action; delete updates.tenantId;
    if (!workflowId) return NextResponse.json({ ok: false, error: 'workflowId required' }, { status: 400 });
    await col.updateOne({ tenantId, workflowId }, { $set: { ...updates, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (action === 'delete') {
    if (!body.workflowId) return NextResponse.json({ ok: false, error: 'workflowId required' }, { status: 400 });
    await col.updateOne({ tenantId, workflowId: body.workflowId }, { $set: { isActive: false, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.workflows.write' });
