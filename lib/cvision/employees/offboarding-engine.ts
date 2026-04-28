import type { Db } from '@/lib/cvision/infra/mongo-compat';

export interface OffboardingItem {
  id: string;
  title: string;
  assignedTo: string;
  status: 'PENDING' | 'COMPLETED';
  completedBy?: string;
  completedAt?: Date;
  notes?: string;
}

export interface FinalSettlement {
  unpaidSalary: number;
  leaveEncashment: number;
  endOfServiceBenefit: number;
  otherAllowances: number;
  deductions: number;
  totalSettlement: number;
  calculatedAt: Date;
}

export interface ExitInterview {
  conductedBy: string;
  conductedAt: Date;
  satisfactionRating: number;
  reasonForLeaving: string;
  feedback: string;
  wouldRecommend: boolean;
  wouldReturn: boolean;
}

export interface OffboardingProcess {
  tenantId: string;
  employeeId: string;
  type: 'RESIGNATION' | 'TERMINATION' | 'END_OF_CONTRACT' | 'RETIREMENT' | 'MUTUAL_AGREEMENT';
  reason: string;
  lastWorkingDay: Date;
  initiatedBy: string;
  initiatedAt: Date;
  status: 'INITIATED' | 'IN_PROGRESS' | 'CLEARANCE_PENDING' | 'FINAL_SETTLEMENT' | 'COMPLETED';
  checklist: OffboardingItem[];
  finalSettlement?: FinalSettlement;
  exitInterview?: ExitInterview;
}

export const DEFAULT_OFFBOARDING_CHECKLIST: Omit<OffboardingItem, 'status'>[] = [
  { id: 'resignation-letter', title: 'Resignation/Termination Letter Filed', assignedTo: 'HR' },
  { id: 'knowledge-transfer', title: 'Knowledge Transfer Completed', assignedTo: 'MANAGER' },
  { id: 'return-laptop', title: 'Return Laptop & Equipment', assignedTo: 'IT' },
  { id: 'return-badge', title: 'Return ID Badge & Access Cards', assignedTo: 'HR' },
  { id: 'revoke-access', title: 'Revoke System Access', assignedTo: 'IT' },
  { id: 'email-forward', title: 'Set Email Forward/Auto-reply', assignedTo: 'IT' },
  { id: 'gosi-deregister', title: 'GOSI De-registration', assignedTo: 'HR' },
  { id: 'medical-cancel', title: 'Cancel Medical Insurance', assignedTo: 'HR' },
  { id: 'visa-cancel', title: 'Cancel/Transfer Visa (if expat)', assignedTo: 'HR' },
  { id: 'loan-settlement', title: 'Settle Outstanding Loans', assignedTo: 'HR' },
  { id: 'exit-interview', title: 'Conduct Exit Interview', assignedTo: 'HR' },
  { id: 'final-settlement', title: 'Process Final Settlement', assignedTo: 'HR' },
  { id: 'experience-letter', title: 'Issue Experience Certificate', assignedTo: 'HR' },
];

/**
 * Saudi Labor Law End of Service Benefit
 * - First 5 years: half month salary per year
 * - After 5 years: full month salary per year
 * - Resignation < 2 years: 0
 * - Resignation 2-5 years: 1/3
 * - Resignation 5-10 years: 2/3
 * - Resignation 10+ years: full
 */
export function calculateEndOfServiceBenefit(
  basicSalary: number, housingAllowance: number, transportAllowance: number,
  yearsOfService: number, terminationType: string,
): number {
  const totalSalary = basicSalary + housingAllowance + transportAllowance;
  let benefit = 0;

  if (yearsOfService <= 5) {
    benefit = (totalSalary / 2) * yearsOfService;
  } else {
    benefit = (totalSalary / 2) * 5;
    benefit += totalSalary * (yearsOfService - 5);
  }

  if (terminationType === 'RESIGNATION') {
    if (yearsOfService < 2) benefit = 0;
    else if (yearsOfService < 5) benefit *= 1 / 3;
    else if (yearsOfService < 10) benefit *= 2 / 3;
  }

  return Math.round(benefit * 100) / 100;
}

export function calculateLeaveEncashment(basicSalary: number, housingAllowance: number, unusedDays: number): number {
  const daily = (basicSalary + housingAllowance) / 30;
  return Math.round(daily * unusedDays * 100) / 100;
}

export async function initiateOffboarding(
  db: Db, tenantId: string, data: {
    employeeId: string; type: string; reason: string; lastWorkingDay: string; initiatedBy: string;
  },
): Promise<string> {
  const checklist: OffboardingItem[] = DEFAULT_OFFBOARDING_CHECKLIST.map(item => ({
    ...item, status: 'PENDING' as const,
  }));

  const process: OffboardingProcess = {
    tenantId,
    employeeId: data.employeeId,
    type: data.type as OffboardingProcess['type'],
    reason: data.reason,
    lastWorkingDay: new Date(data.lastWorkingDay),
    initiatedBy: data.initiatedBy,
    initiatedAt: new Date(),
    status: 'INITIATED',
    checklist,
  };

  const result = await db.collection('cvision_offboarding').insertOne(process);

  await db.collection('cvision_employees').updateOne(
    { tenantId, employeeId: data.employeeId },
    { $set: { status: 'OFFBOARDING', lastWorkingDay: new Date(data.lastWorkingDay), updatedAt: new Date() } },
  );

  return result.insertedId.toString();
}

export async function completeOffboardingItem(
  db: Db, tenantId: string, employeeId: string, itemId: string, completedBy: string, notes?: string,
): Promise<{ completedCount: number; totalCount: number }> {
  const process = await db.collection('cvision_offboarding').findOne({
    tenantId, employeeId, status: { $ne: 'COMPLETED' },
  });
  if (!process) throw new Error('No active offboarding');

  const idx = process.checklist.findIndex((c: any) => c.id === itemId);
  if (idx === -1) throw new Error('Checklist item not found');

  process.checklist[idx] = {
    ...process.checklist[idx], status: 'COMPLETED', completedBy, completedAt: new Date(), notes,
  };

  const completedCount = process.checklist.filter((c: any) => c.status === 'COMPLETED').length;
  const newStatus = completedCount === process.checklist.length ? 'CLEARANCE_PENDING' : 'IN_PROGRESS';

  await db.collection('cvision_offboarding').updateOne(
    { _id: process._id, tenantId },
    { $set: { checklist: process.checklist, status: newStatus, updatedAt: new Date() } },
  );

  return { completedCount, totalCount: process.checklist.length };
}

export async function calculateFinalSettlement(
  db: Db, tenantId: string, employeeId: string,
): Promise<FinalSettlement> {
  const employee = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId });
  if (!employee) throw new Error('Employee not found');

  const offboarding = await db.collection('cvision_offboarding').findOne({
    tenantId, employeeId, status: { $ne: 'COMPLETED' },
  });
  if (!offboarding) throw new Error('No active offboarding');

  const hireDate = new Date(employee.hiredAt || employee.hireDate);
  const lastDay = new Date(offboarding.lastWorkingDay);
  const years = (lastDay.getTime() - hireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

  const basic = employee.basicSalary || 0;
  const housing = employee.housingAllowance || 0;
  const transport = employee.transportAllowance || 0;

  const dayOfMonth = lastDay.getDate();
  const unpaidSalary = Math.round(((basic + housing + transport) / 30) * dayOfMonth * 100) / 100;

  const leaveBalance = employee.leaveBalance || 0;
  const leaveEncashment = calculateLeaveEncashment(basic, housing, leaveBalance);

  const endOfServiceBenefit = calculateEndOfServiceBenefit(basic, housing, transport, years, offboarding.type);

  const loans = await db.collection('cvision_loans').find({
    tenantId, employeeId, status: { $in: ['active', 'ACTIVE'] },
  }).toArray();
  const deductions = loans.reduce((s: number, l: any) => s + (l.remaining || l.remainingAmount || l.remainingBalance || 0), 0);

  const settlement: FinalSettlement = {
    unpaidSalary,
    leaveEncashment,
    endOfServiceBenefit,
    otherAllowances: 0,
    deductions,
    totalSettlement: Math.round((unpaidSalary + leaveEncashment + endOfServiceBenefit - deductions) * 100) / 100,
    calculatedAt: new Date(),
  };

  await db.collection('cvision_offboarding').updateOne(
    { _id: offboarding._id, tenantId },
    { $set: { finalSettlement: settlement, status: 'FINAL_SETTLEMENT', updatedAt: new Date() } },
  );

  return settlement;
}

export async function saveExitInterview(
  db: Db, tenantId: string, employeeId: string, interview: ExitInterview,
): Promise<void> {
  await db.collection('cvision_offboarding').updateOne(
    { tenantId, employeeId, status: { $ne: 'COMPLETED' } },
    { $set: { exitInterview: interview, updatedAt: new Date() } },
  );
}

export async function completeOffboarding(
  db: Db, tenantId: string, employeeId: string,
): Promise<void> {
  await db.collection('cvision_offboarding').updateOne(
    { tenantId, employeeId, status: { $ne: 'COMPLETED' } },
    { $set: { status: 'COMPLETED', completedAt: new Date() } },
  );

  await db.collection('cvision_employees').updateOne(
    { tenantId, employeeId },
    { $set: { status: 'TERMINATED', terminatedAt: new Date(), updatedAt: new Date() } },
  );
}

export async function getOffboarding(db: Db, tenantId: string, employeeId: string) {
  return db.collection('cvision_offboarding').findOne({ tenantId, employeeId, status: { $ne: 'COMPLETED' } });
}

export async function getAllOffboardings(db: Db, tenantId: string, statusFilter?: string) {
  const filter: any = { tenantId };
  if (statusFilter) filter.status = statusFilter;
  return db.collection('cvision_offboarding').find(filter).sort({ initiatedAt: -1 }).toArray();
}
