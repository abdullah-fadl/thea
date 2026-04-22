import type { Db, ObjectId } from '@/lib/cvision/infra/mongo-compat';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  category: 'DOCUMENTS' | 'IT_SETUP' | 'HR_TASKS' | 'TRAINING' | 'COMPLIANCE';
  assignedTo: 'HR' | 'IT' | 'MANAGER' | 'EMPLOYEE';
  daysFromHire: number;
  isRequired: boolean;
}

export interface OnboardingStepStatus {
  stepId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  completedBy?: string;
  completedAt?: Date;
  notes?: string;
}

export interface EmployeeOnboarding {
  tenantId: string;
  employeeId: string;
  templateId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  startDate: Date;
  completedDate?: Date;
  steps: OnboardingStepStatus[];
  progress: number;
}

export interface OnboardingTemplate {
  tenantId: string;
  name: string;
  steps: OnboardingStep[];
  isDefault: boolean;
  createdAt: Date;
}

export const DEFAULT_ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'collect-docs', title: 'Collect Required Documents', description: 'National ID/Iqama, passport, certificates, bank letter', category: 'DOCUMENTS', assignedTo: 'HR', daysFromHire: 0, isRequired: true },
  { id: 'employment-contract', title: 'Sign Employment Contract', description: 'Review and sign employment contract', category: 'HR_TASKS', assignedTo: 'HR', daysFromHire: 0, isRequired: true },
  { id: 'gosi-registration', title: 'GOSI Registration', description: 'Register employee in GOSI system', category: 'COMPLIANCE', assignedTo: 'HR', daysFromHire: 1, isRequired: true },
  { id: 'mudad-registration', title: 'Mudad Registration', description: 'Register in Mudad for wage protection', category: 'COMPLIANCE', assignedTo: 'HR', daysFromHire: 1, isRequired: true },
  { id: 'it-setup', title: 'IT Setup (Email, Access)', description: 'Create email account, system access, badge', category: 'IT_SETUP', assignedTo: 'IT', daysFromHire: 1, isRequired: true },
  { id: 'workspace-setup', title: 'Workspace Preparation', description: 'Desk, equipment, supplies ready', category: 'IT_SETUP', assignedTo: 'MANAGER', daysFromHire: 1, isRequired: true },
  { id: 'welcome-orientation', title: 'Welcome & Orientation', description: 'Company overview, policies, tour', category: 'TRAINING', assignedTo: 'HR', daysFromHire: 1, isRequired: true },
  { id: 'team-intro', title: 'Team Introduction', description: 'Meet team members and key stakeholders', category: 'TRAINING', assignedTo: 'MANAGER', daysFromHire: 3, isRequired: true },
  { id: 'system-training', title: 'Systems Training', description: 'Training on internal systems and tools', category: 'TRAINING', assignedTo: 'IT', daysFromHire: 5, isRequired: true },
  { id: 'policy-review', title: 'Policy Review & Sign-off', description: 'Read and acknowledge company policies', category: 'COMPLIANCE', assignedTo: 'EMPLOYEE', daysFromHire: 5, isRequired: true },
  { id: 'bank-account', title: 'Bank Account Verification', description: 'Verify IBAN for salary transfer', category: 'HR_TASKS', assignedTo: 'HR', daysFromHire: 7, isRequired: true },
  { id: 'medical-insurance', title: 'Medical Insurance Enrollment', description: 'Enroll in company medical insurance', category: 'HR_TASKS', assignedTo: 'HR', daysFromHire: 14, isRequired: true },
  { id: '30-day-checkin', title: '30-Day Check-in', description: 'Manager check-in meeting at 30 days', category: 'HR_TASKS', assignedTo: 'MANAGER', daysFromHire: 30, isRequired: true },
  { id: 'probation-review', title: 'Probation Period Review', description: 'Evaluate performance during probation', category: 'HR_TASKS', assignedTo: 'MANAGER', daysFromHire: 90, isRequired: true },
];

export async function createOnboarding(
  db: Db, tenantId: string, employeeId: string, templateId?: string,
): Promise<string> {
  let template: any = null;
  if (templateId) {
    const { ObjectId } = await import('mongodb');
    const idFilter = ObjectId.isValid(templateId) ? new ObjectId(templateId) : templateId;
    template = await db.collection('cvision_onboarding_templates').findOne({ tenantId, $or: [{ id: templateId }, { _id: idFilter as unknown }] });
  }
  if (!template) {
    template = await db.collection('cvision_onboarding_templates').findOne({ tenantId, isDefault: true });
  }

  const steps: OnboardingStepStatus[] = (template?.steps || DEFAULT_ONBOARDING_STEPS).map((s: OnboardingStep) => ({
    stepId: s.id,
    status: 'PENDING' as const,
  }));

  const onboarding: EmployeeOnboarding = {
    tenantId, employeeId,
    templateId: template?._id?.toString() || 'default',
    status: 'IN_PROGRESS',
    startDate: new Date(),
    steps,
    progress: 0,
  };

  const result = await db.collection('cvision_employee_onboarding').insertOne(onboarding);
  return result.insertedId.toString();
}

export async function completeOnboardingStep(
  db: Db, tenantId: string, employeeId: string, stepId: string, completedBy: string, notes?: string,
): Promise<{ progress: number; status: string }> {
  const onboarding = await db.collection('cvision_employee_onboarding').findOne({
    tenantId, employeeId, status: { $in: ['IN_PROGRESS', 'OVERDUE'] },
  });
  if (!onboarding) throw new Error('No active onboarding found');

  const idx = onboarding.steps.findIndex((s: any) => s.stepId === stepId);
  if (idx === -1) throw new Error('Step not found');

  onboarding.steps[idx] = {
    ...onboarding.steps[idx],
    status: 'COMPLETED',
    completedBy,
    completedAt: new Date(),
    notes: notes || undefined,
  };

  const completedCount = onboarding.steps.filter((s: any) => s.status === 'COMPLETED' || s.status === 'SKIPPED').length;
  const progress = onboarding.steps.length > 0 ? Math.round((completedCount / onboarding.steps.length) * 100) : 0;
  const allDone = progress === 100;

  await db.collection('cvision_employee_onboarding').updateOne(
    { _id: onboarding._id, tenantId },
    { $set: { steps: onboarding.steps, progress, status: allDone ? 'COMPLETED' : onboarding.status, ...(allDone ? { completedDate: new Date() } : {}) } },
  );

  return { progress, status: allDone ? 'COMPLETED' : onboarding.status };
}

export async function skipOnboardingStep(
  db: Db, tenantId: string, employeeId: string, stepId: string, skippedBy: string, reason: string,
): Promise<{ progress: number }> {
  const onboarding = await db.collection('cvision_employee_onboarding').findOne({
    tenantId, employeeId, status: { $in: ['IN_PROGRESS', 'OVERDUE'] },
  });
  if (!onboarding) throw new Error('No active onboarding found');

  const idx = onboarding.steps.findIndex((s: any) => s.stepId === stepId);
  if (idx === -1) throw new Error('Step not found');

  onboarding.steps[idx] = { ...onboarding.steps[idx], status: 'SKIPPED', completedBy: skippedBy, completedAt: new Date(), notes: `Skipped: ${reason}` };

  const completedCount = onboarding.steps.filter((s: any) => s.status === 'COMPLETED' || s.status === 'SKIPPED').length;
  const progress = onboarding.steps.length > 0 ? Math.round((completedCount / onboarding.steps.length) * 100) : 0;
  const allDone = progress === 100;

  await db.collection('cvision_employee_onboarding').updateOne(
    { _id: onboarding._id, tenantId },
    { $set: { steps: onboarding.steps, progress, status: allDone ? 'COMPLETED' : onboarding.status, ...(allDone ? { completedDate: new Date() } : {}) } },
  );

  return { progress };
}

export async function getOnboardingStatus(db: Db, tenantId: string, employeeId: string) {
  return db.collection('cvision_employee_onboarding').findOne({ tenantId, employeeId });
}

export async function getAllOnboardings(db: Db, tenantId: string, statusFilter?: string) {
  const filter: any = { tenantId };
  if (statusFilter) filter.status = statusFilter;
  return db.collection('cvision_employee_onboarding')
    .find(filter).sort({ startDate: -1 }).toArray();
}

export async function getOnboardingTemplates(db: Db, tenantId: string) {
  const custom = await db.collection('cvision_onboarding_templates').find({ tenantId }).toArray();
  if (custom.length > 0) return custom;
  return [{ _id: 'default', tenantId, name: 'Default Saudi Onboarding', steps: DEFAULT_ONBOARDING_STEPS, isDefault: true, createdAt: new Date() }];
}

export async function saveOnboardingTemplate(
  db: Db, tenantId: string, template: { name: string; steps: OnboardingStep[]; isDefault: boolean },
): Promise<string> {
  if (template.isDefault) {
    await db.collection('cvision_onboarding_templates').updateMany({ tenantId }, { $set: { isDefault: false } });
  }
  const result = await db.collection('cvision_onboarding_templates').insertOne({ ...template, tenantId, createdAt: new Date() });
  return result.insertedId.toString();
}
