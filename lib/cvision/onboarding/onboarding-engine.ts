import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type TaskCategory = 'DOCUMENTS' | 'IT' | 'FACILITIES' | 'HR' | 'FINANCE' | 'DEPARTMENT' | 'COMPLIANCE' | 'TRAINING';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'OVERDUE';
export type ProcessStatus = 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
export type ProcessType = 'ONBOARDING' | 'OFFBOARDING';
export type OffboardingReason = 'RESIGNATION' | 'TERMINATION' | 'CONTRACT_END' | 'RETIREMENT' | 'MUTUAL';

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  DOCUMENTS: 'Documents', IT: 'IT Setup', FACILITIES: 'Facilities', HR: 'Human Resources',
  FINANCE: 'Finance', DEPARTMENT: 'Department', COMPLIANCE: 'Compliance', TRAINING: 'Training',
};

export const CATEGORY_COLORS: Record<TaskCategory, string> = {
  DOCUMENTS: 'bg-blue-100 text-blue-700', IT: 'bg-purple-100 text-purple-700',
  FACILITIES: 'bg-green-100 text-green-700', HR: 'bg-rose-100 text-rose-700',
  FINANCE: 'bg-amber-100 text-amber-700', DEPARTMENT: 'bg-cyan-100 text-cyan-700',
  COMPLIANCE: 'bg-red-100 text-red-700', TRAINING: 'bg-indigo-100 text-indigo-700',
};

/* ── Templates ─────────────────────────────────────────────────────── */

export const ONBOARDING_TEMPLATE = [
  { category: 'DOCUMENTS' as TaskCategory, title: 'Collect national ID copy', assignTo: 'HR', required: true, dayOffset: 0 },
  { category: 'DOCUMENTS', title: 'Collect educational certificates', assignTo: 'HR', required: true, dayOffset: 0 },
  { category: 'DOCUMENTS', title: 'Collect bank letter/IBAN', assignTo: 'HR', required: true, dayOffset: 0 },
  { category: 'DOCUMENTS', title: 'Sign employment contract', assignTo: 'HR', required: true, dayOffset: 0 },
  { category: 'HR', title: 'Create employee profile in system', assignTo: 'HR', required: true, dayOffset: 0 },
  { category: 'HR', title: 'Register in GOSI', assignTo: 'HR', required: true, dayOffset: 2 },
  { category: 'HR', title: 'Enroll in health insurance', assignTo: 'HR', required: true, dayOffset: 2 },
  { category: 'HR', title: 'Assign to department & manager', assignTo: 'HR', required: true, dayOffset: 0 },
  { category: 'IT', title: 'Create email account', assignTo: 'IT', required: true, dayOffset: 0 },
  { category: 'IT', title: 'Setup laptop/workstation', assignTo: 'IT', required: true, dayOffset: 0 },
  { category: 'IT', title: 'Grant system access & permissions', assignTo: 'IT', required: true, dayOffset: 0 },
  { category: 'IT', title: 'Setup phone extension', assignTo: 'IT', required: false, dayOffset: 1 },
  { category: 'FACILITIES', title: 'Issue access badge/key card', assignTo: 'FACILITIES', required: true, dayOffset: 0 },
  { category: 'FACILITIES', title: 'Assign desk/workspace', assignTo: 'FACILITIES', required: true, dayOffset: 0 },
  { category: 'FACILITIES', title: 'Assign parking spot', assignTo: 'FACILITIES', required: false, dayOffset: 1 },
  { category: 'DEPARTMENT', title: 'Welcome meeting with manager', assignTo: 'MANAGER', required: true, dayOffset: 0 },
  { category: 'DEPARTMENT', title: 'Team introduction', assignTo: 'MANAGER', required: true, dayOffset: 0 },
  { category: 'DEPARTMENT', title: 'Assign buddy/mentor', assignTo: 'MANAGER', required: false, dayOffset: 0 },
  { category: 'DEPARTMENT', title: 'First week plan & assignments', assignTo: 'MANAGER', required: true, dayOffset: 0 },
  { category: 'TRAINING', title: 'Company orientation session', assignTo: 'HR', required: true, dayOffset: 2 },
  { category: 'TRAINING', title: 'Safety training', assignTo: 'SAFETY', required: true, dayOffset: 6 },
  { category: 'TRAINING', title: 'System training (HR portal)', assignTo: 'IT', required: true, dayOffset: 4 },
  { category: 'COMPLIANCE', title: 'Read & sign company policies', assignTo: 'EMPLOYEE', required: true, dayOffset: 6 },
  { category: 'COMPLIANCE', title: 'NDA/Confidentiality agreement', assignTo: 'HR', required: true, dayOffset: 0 },
  { category: 'COMPLIANCE', title: 'Data protection awareness', assignTo: 'EMPLOYEE', required: true, dayOffset: 13 },
];

export const OFFBOARDING_TEMPLATE = [
  { category: 'HR' as TaskCategory, title: 'Accept resignation/termination', assignTo: 'HR', required: true, dayOffset: 0 },
  { category: 'HR', title: 'Calculate final settlement', assignTo: 'HR', required: true, dayOffset: 5 },
  { category: 'HR', title: 'Cancel health insurance', assignTo: 'HR', required: true, dayOffset: 7 },
  { category: 'HR', title: 'Deregister from GOSI', assignTo: 'HR', required: true, dayOffset: 7 },
  { category: 'HR', title: 'Issue experience letter', assignTo: 'HR', required: true, dayOffset: 10 },
  { category: 'HR', title: 'Conduct exit interview', assignTo: 'HR', required: true, dayOffset: 5 },
  { category: 'IT', title: 'Revoke system access', assignTo: 'IT', required: true, dayOffset: 0 },
  { category: 'IT', title: 'Deactivate email account', assignTo: 'IT', required: true, dayOffset: 1 },
  { category: 'IT', title: 'Collect laptop/equipment', assignTo: 'IT', required: true, dayOffset: 0 },
  { category: 'IT', title: 'Transfer files/data ownership', assignTo: 'IT', required: true, dayOffset: 3 },
  { category: 'FACILITIES', title: 'Collect access badge/keys', assignTo: 'FACILITIES', required: true, dayOffset: 0 },
  { category: 'FACILITIES', title: 'Clear desk/workspace', assignTo: 'FACILITIES', required: true, dayOffset: 0 },
  { category: 'FINANCE', title: 'Settle outstanding loans', assignTo: 'FINANCE', required: true, dayOffset: 5 },
  { category: 'FINANCE', title: 'Process final salary', assignTo: 'FINANCE', required: true, dayOffset: 7 },
  { category: 'FINANCE', title: 'Process end of service', assignTo: 'FINANCE', required: true, dayOffset: 10 },
  { category: 'FINANCE', title: 'Settle expense claims', assignTo: 'FINANCE', required: true, dayOffset: 5 },
  { category: 'DEPARTMENT', title: 'Knowledge transfer plan', assignTo: 'MANAGER', required: true, dayOffset: 0 },
  { category: 'DEPARTMENT', title: 'Handover documentation', assignTo: 'EMPLOYEE', required: true, dayOffset: 5 },
  { category: 'DEPARTMENT', title: 'Reassign tasks & projects', assignTo: 'MANAGER', required: true, dayOffset: 3 },
];

/* ── Seed Data ─────────────────────────────────────────────────────── */

export async function ensureSeedData(db: Db, tenantId: string): Promise<void> {
  const coll = db.collection('cvision_onboarding_processes');
  const count = await coll.countDocuments({ tenantId });
  if (count > 0) return;

  const now = new Date();
  const startDate = new Date('2026-02-15');

  const tasks = ONBOARDING_TEMPLATE.map((t, i) => {
    const due = new Date(startDate);
    due.setDate(due.getDate() + t.dayOffset);
    const completed = i < 15;
    return {
      taskId: `TSK-${String(i + 1).padStart(3, '0')}`,
      category: t.category, title: t.title,
      assignedTo: t.assignTo, assignedToName: t.assignTo,
      dueDate: due,
      status: completed ? 'COMPLETED' as TaskStatus : (due < now ? 'OVERDUE' as TaskStatus : 'PENDING' as TaskStatus),
      completedBy: completed ? 'SYSTEM' : undefined,
      completedAt: completed ? new Date(due.getTime() + 86400000) : undefined,
      required: t.required, order: i + 1,
    };
  });

  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;

  await coll.insertOne({
    tenantId,
    processId: 'OBP-2026-001',
    employeeId: 'EMP-007',
    employeeName: 'Ali Al-Mutairi',
    type: 'ONBOARDING' as ProcessType,
    templateId: 'default-onboarding',
    tasks,
    totalTasks: tasks.length,
    completedTasks: completedCount,
    progressPercentage: Math.round((completedCount / tasks.length) * 100),
    startDate,
    targetCompletionDate: new Date('2026-03-01'),
    status: 'IN_PROGRESS' as ProcessStatus,
    createdAt: now, updatedAt: now,
  });
}

export function buildTasksFromTemplate(template: typeof ONBOARDING_TEMPLATE, startDate: Date): any[] {
  return template.map((t, i) => {
    const due = new Date(startDate);
    due.setDate(due.getDate() + t.dayOffset);
    return {
      taskId: `TSK-${String(i + 1).padStart(3, '0')}`,
      category: t.category, title: t.title,
      assignedTo: t.assignTo, assignedToName: t.assignTo,
      dueDate: due, status: 'PENDING' as TaskStatus,
      required: t.required, order: i + 1,
    };
  });
}
