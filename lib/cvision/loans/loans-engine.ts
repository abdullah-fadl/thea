import type { Db } from '@/lib/cvision/infra/mongo-compat';
import type { LoanDocument, LoanGuarantor } from '@/lib/cvision/types';

/* ── Types ─────────────────────────────────────────────────────────── */

export type LoanType = 'SALARY_ADVANCE' | 'PERSONAL_LOAN' | 'HOUSING_LOAN' | 'EMERGENCY_LOAN' | 'CAR_LOAN';
export type LoanStatus = 'PENDING' | 'ACTIVE' | 'PAID_OFF' | 'CANCELLED';
export type InstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIALLY_PAID';

export interface Installment {
  installmentNumber: number;
  dueDate: Date;
  amount: number;
  status: InstallmentStatus;
  paidAmount: number;
  paidDate?: Date;
  payrollMonth?: string;
}

export interface LoanApproval {
  step: 'MANAGER' | 'HR' | 'FINANCE';
  approverId: string;
  approverName: string;
  decision: 'APPROVED' | 'REJECTED';
  notes?: string;
  date: Date;
}

export interface LoanPolicy {
  maxAmount: string;
  maxInstallments: number;
  requiresGuarantor: boolean;
  approvalChain: ('MANAGER' | 'HR' | 'FINANCE')[];
  cooldownDays: number;
  maxActiveLoans: number;
  interestRate: number;
  minTenure?: number;
}

/* ── Loan Policies ─────────────────────────────────────────────────── */

export const LOAN_POLICIES: Record<LoanType, LoanPolicy> = {
  SALARY_ADVANCE: {
    maxAmount: 'ONE_MONTH_SALARY',
    maxInstallments: 3,
    requiresGuarantor: false,
    approvalChain: ['MANAGER', 'HR'],
    cooldownDays: 30,
    maxActiveLoans: 1,
    interestRate: 0,
  },
  PERSONAL_LOAN: {
    maxAmount: 'THREE_MONTHS_SALARY',
    maxInstallments: 12,
    requiresGuarantor: false,
    approvalChain: ['MANAGER', 'HR', 'FINANCE'],
    cooldownDays: 90,
    maxActiveLoans: 1,
    interestRate: 0,
  },
  HOUSING_LOAN: {
    maxAmount: 'TWELVE_MONTHS_SALARY',
    maxInstallments: 48,
    requiresGuarantor: true,
    approvalChain: ['MANAGER', 'HR', 'FINANCE'],
    cooldownDays: 365,
    maxActiveLoans: 1,
    interestRate: 0,
    minTenure: 365,
  },
  EMERGENCY_LOAN: {
    maxAmount: 'TWO_MONTHS_SALARY',
    maxInstallments: 6,
    requiresGuarantor: false,
    approvalChain: ['HR'],
    cooldownDays: 60,
    maxActiveLoans: 1,
    interestRate: 0,
  },
  CAR_LOAN: {
    maxAmount: 'SIX_MONTHS_SALARY',
    maxInstallments: 24,
    requiresGuarantor: true,
    approvalChain: ['MANAGER', 'HR', 'FINANCE'],
    cooldownDays: 365,
    maxActiveLoans: 1,
    interestRate: 0,
  },
};

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  SALARY_ADVANCE: 'Salary Advance',
  PERSONAL_LOAN: 'Personal Loan',
  HOUSING_LOAN: 'Housing Loan',
  EMERGENCY_LOAN: 'Emergency Loan',
  CAR_LOAN: 'Car Loan',
};

const SALARY_MULTIPLIERS: Record<string, number> = {
  ONE_MONTH_SALARY: 1,
  TWO_MONTHS_SALARY: 2,
  THREE_MONTHS_SALARY: 3,
  SIX_MONTHS_SALARY: 6,
  TWELVE_MONTHS_SALARY: 12,
};

/* ── Helpers ───────────────────────────────────────────────────────── */

export function getMaxAmountForType(type: LoanType, monthlySalary: number): number {
  const policy = LOAN_POLICIES[type];
  const multiplier = SALARY_MULTIPLIERS[policy.maxAmount] || 1;
  return monthlySalary * multiplier;
}

export function generateInstallmentSchedule(
  amount: number,
  installments: number,
  startDate: Date,
  interestRate: number = 0,
): Installment[] {
  const totalRepayment = amount * (1 + interestRate / 100);
  const monthlyAmount = Math.ceil(totalRepayment / installments);
  const schedule: Installment[] = [];

  for (let i = 0; i < installments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    const isLast = i === installments - 1;
    const paid = monthlyAmount * i;
    const remaining = totalRepayment - paid;
    const amt = isLast ? Math.round(remaining) : monthlyAmount;

    const ym = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;

    schedule.push({
      installmentNumber: i + 1,
      dueDate,
      amount: amt,
      status: 'PENDING',
      paidAmount: 0,
      payrollMonth: ym,
    });
  }

  return schedule;
}

function getNextApprovalStep(policy: LoanPolicy, currentApprovals: LoanApproval[]): 'MANAGER' | 'HR' | 'FINANCE' | null {
  const approvedSteps = new Set(
    currentApprovals.filter(a => a.decision === 'APPROVED').map(a => a.step)
  );
  for (const step of policy.approvalChain) {
    if (!approvedSteps.has(step)) return step;
  }
  return null;
}

function getLoanStatusAfterApproval(policy: LoanPolicy, approvals: LoanApproval[]): LoanStatus {
  const approvedSteps = new Set(
    approvals.filter(a => a.decision === 'APPROVED').map(a => a.step)
  );
  const allApproved = policy.approvalChain.every(s => approvedSteps.has(s));
  if (allApproved) return 'ACTIVE';
  return 'PENDING';
}

/* ── Eligibility Check ─────────────────────────────────────────────── */

export async function checkEligibility(
  db: Db, tenantId: string, employeeId: string, type: LoanType,
): Promise<{ eligible: boolean; reason?: string; maxAmount: number; monthlySalary: number }> {
  const policy = LOAN_POLICIES[type];

  const employee = await db.collection('cvision_employees').findOne({
    tenantId, employeeId,
  });
  if (!employee) return { eligible: false, reason: 'Employee not found', maxAmount: 0, monthlySalary: 0 };

  const status = employee.status?.toUpperCase();
  if (!['ACTIVE', 'PROBATION'].includes(status)) {
    return { eligible: false, reason: 'Employee is not in active status', maxAmount: 0, monthlySalary: 0 };
  }

  // Salary
  const profile = await db.collection('cvision_payroll_profiles').findOne({ tenantId, employeeId });
  const basicSalary = profile?.basicSalary || employee.basicSalary || employee.salary || 0;
  const housingAllowance = profile?.housingAllowance || 0;
  const transportAllowance = profile?.transportAllowance || 0;
  const monthlySalary = basicSalary + housingAllowance + transportAllowance;

  if (monthlySalary <= 0) {
    return { eligible: false, reason: 'No salary record found', maxAmount: 0, monthlySalary };
  }

  // Tenure check
  if (policy.minTenure) {
    const hireDate = employee.hireDate ? new Date(employee.hireDate) : null;
    if (!hireDate) return { eligible: false, reason: 'Hire date not set', maxAmount: 0, monthlySalary };
    const daysSinceHire = (Date.now() - hireDate.getTime()) / 86400000;
    if (daysSinceHire < policy.minTenure) {
      return {
        eligible: false,
        reason: `Minimum tenure of ${Math.round(policy.minTenure / 365)} year(s) required`,
        maxAmount: 0, monthlySalary,
      };
    }
  }

  // Active loans of same type
  const activeLoans = await db.collection('cvision_loans').countDocuments({
    tenantId, employeeId, type,
    status: { $in: ['PENDING', 'ACTIVE'] },
  });
  if (activeLoans >= policy.maxActiveLoans) {
    return { eligible: false, reason: `Already have ${activeLoans} active ${LOAN_TYPE_LABELS[type]}`, maxAmount: 0, monthlySalary };
  }

  // Cooldown
  const lastCompleted = await db.collection('cvision_loans').findOne({
    tenantId, employeeId, type,
    status: { $in: ['PAID_OFF', 'CANCELLED'] },
  }, { sort: { updatedAt: -1 } });

  if (lastCompleted) {
    const lastDate = new Date(lastCompleted.actualCompletionDate || lastCompleted.updatedAt || lastCompleted.createdAt);
    const daysSince = (Date.now() - lastDate.getTime()) / 86400000;
    if (daysSince < policy.cooldownDays) {
      return {
        eligible: false,
        reason: `Cooldown period: ${Math.ceil(policy.cooldownDays - daysSince)} days remaining`,
        maxAmount: 0, monthlySalary,
      };
    }
  }

  const maxAmount = getMaxAmountForType(type, monthlySalary);
  return { eligible: true, maxAmount, monthlySalary };
}

/* ── Create Loan Request ───────────────────────────────────────────── */

export async function createLoanRequest(
  db: Db, tenantId: string,
  data: {
    employeeId: string;
    type: LoanType;
    requestedAmount: number;
    installments: number;
    reason: string;
    guarantorEmployeeId?: string;
    createdBy: string;
  },
): Promise<{ loanId: string } | { error: string }> {
  const policy = LOAN_POLICIES[data.type];

  // Validate eligibility
  const elig = await checkEligibility(db, tenantId, data.employeeId, data.type);
  if (!elig.eligible) return { error: elig.reason || 'Not eligible' };

  if (data.requestedAmount > elig.maxAmount) {
    return { error: `Requested amount exceeds maximum of ${elig.maxAmount} SAR` };
  }
  if (data.installments > policy.maxInstallments) {
    return { error: `Maximum ${policy.maxInstallments} installments allowed` };
  }
  if (data.installments < 1) {
    return { error: 'At least 1 installment required' };
  }

  // Guarantor
  let guarantor: LoanGuarantor | undefined = undefined;
  if (policy.requiresGuarantor) {
    if (!data.guarantorEmployeeId) return { error: 'Guarantor required for this loan type' };
    const guarantorEmp = await db.collection('cvision_employees').findOne({
      tenantId, employeeId: data.guarantorEmployeeId,
    });
    if (!guarantorEmp) return { error: 'Guarantor employee not found' };
    guarantor = {
      employeeId: data.guarantorEmployeeId,
      employeeName: guarantorEmp.fullName || guarantorEmp.name || '',
      acknowledged: false,
    };
  }

  const employee = await db.collection('cvision_employees').findOne({ tenantId, id: data.employeeId });

  const count = await db.collection('cvision_loans').countDocuments({ tenantId });
  const loanId = `LOAN-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

  const installmentAmount = Math.ceil(data.requestedAmount / data.installments);
  const firstInstDate = new Date();
  firstInstDate.setMonth(firstInstDate.getMonth() + 1);
  firstInstDate.setDate(1);

  const schedule = generateInstallmentSchedule(
    data.requestedAmount, data.installments, firstInstDate, policy.interestRate,
  );

  const expectedCompletion = new Date(firstInstDate);
  expectedCompletion.setMonth(expectedCompletion.getMonth() + data.installments - 1);

  const loan = {
    tenantId, loanId,
    employeeId: data.employeeId,
    employeeName: employee?.fullName || employee?.name || data.employeeId,
    type: data.type,
    requestedAmount: data.requestedAmount,
    approvedAmount: 0,
    currency: 'SAR' as const,
    repaymentMethod: 'SALARY_DEDUCTION' as const,
    installments: data.installments,
    installmentAmount,
    interestRate: policy.interestRate,
    totalRepayment: data.requestedAmount,
    installmentSchedule: schedule,
    totalPaid: 0,
    remainingBalance: data.requestedAmount,
    requestDate: new Date(),
    firstInstallmentDate: firstInstDate,
    expectedCompletionDate: expectedCompletion,
    status: 'PENDING' as LoanStatus,
    approvals: [] as LoanApproval[],
    reason: data.reason,
    guarantor,
    createdBy: data.createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('cvision_loans').insertOne(loan);
  return { loanId };
}

/* ── Approve / Reject ──────────────────────────────────────────────── */

export async function approveLoan(
  db: Db, tenantId: string, loanId: string,
  approval: { step: 'MANAGER' | 'HR' | 'FINANCE'; approverId: string; approverName: string; notes?: string },
): Promise<{ success: boolean; error?: string; newStatus?: string }> {
  const loanDoc = await db.collection('cvision_loans').findOne({ tenantId, loanId }) as LoanDocument | null;
  if (!loanDoc) return { success: false, error: 'Loan not found' };
  if (['CANCELLED', 'PAID_OFF', 'ACTIVE'].includes(loanDoc.status)) {
    return { success: false, error: `Cannot approve loan in ${loanDoc.status} status` };
  }

  const policy = LOAN_POLICIES[loanDoc.type];
  const nextStep = getNextApprovalStep(policy, loanDoc.approvals || []);
  if (!nextStep) return { success: false, error: 'All approvals already complete' };
  if (nextStep !== approval.step) return { success: false, error: `Next required approval is ${nextStep}` };

  const newApproval: LoanApproval = {
    step: approval.step,
    approverId: approval.approverId,
    approverName: approval.approverName,
    decision: 'APPROVED',
    notes: approval.notes,
    date: new Date(),
  };

  const updatedApprovals = [...(loanDoc.approvals || []), newApproval];
  const newStatus = getLoanStatusAfterApproval(policy, updatedApprovals);

  const updateSet: Record<string, unknown> = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (newStatus === 'ACTIVE') {
    updateSet.approvedAmount = loanDoc.requestedAmount;
    updateSet.approvalDate = new Date();
  }

  const update = {
    $push: { approvals: newApproval },
    $set: updateSet,
  };

  await db.collection('cvision_loans').updateOne({ tenantId, loanId }, update);
  return { success: true, newStatus };
}

export async function rejectLoan(
  db: Db, tenantId: string, loanId: string,
  rejection: { step: 'MANAGER' | 'HR' | 'FINANCE'; approverId: string; approverName: string; notes: string },
): Promise<{ success: boolean; error?: string }> {
  const loan = await db.collection('cvision_loans').findOne({ tenantId, loanId });
  if (!loan) return { success: false, error: 'Loan not found' };

  const newApproval: LoanApproval = {
    step: rejection.step,
    approverId: rejection.approverId,
    approverName: rejection.approverName,
    decision: 'REJECTED',
    notes: rejection.notes,
    date: new Date(),
  };

  await db.collection('cvision_loans').updateOne({ tenantId, loanId }, {
    $push: { approvals: newApproval },
    $set: { status: 'CANCELLED', updatedAt: new Date() },
  });

  return { success: true };
}

/* ── Disburse ──────────────────────────────────────────────────────── */

export async function disburseLoan(
  db: Db, tenantId: string, loanId: string,
): Promise<{ success: boolean; error?: string }> {
  const loanDoc = await db.collection('cvision_loans').findOne({ tenantId, loanId }) as LoanDocument | null;
  if (!loanDoc) return { success: false, error: 'Loan not found' };
  if (loanDoc.status !== 'ACTIVE') {
    return { success: false, error: 'Loan must be approved (ACTIVE) before disbursement' };
  }

  await db.collection('cvision_loans').updateOne({ tenantId, loanId }, {
    $set: {
      disbursementDate: new Date(),
      updatedAt: new Date(),
    },
  });

  return { success: true };
}

/* ── Record Payment / Payroll Deduction ────────────────────────────── */

export async function recordPayment(
  db: Db, tenantId: string, loanId: string,
  installmentNumber: number, amount: number, payrollMonth?: string,
): Promise<{ success: boolean; error?: string; loanCompleted?: boolean }> {
  const loanDoc = await db.collection('cvision_loans').findOne({ tenantId, loanId }) as LoanDocument | null;
  if (!loanDoc) return { success: false, error: 'Loan not found' };
  if (loanDoc.status !== 'ACTIVE') {
    return { success: false, error: 'Loan is not in active status' };
  }

  const schedule: Installment[] = loanDoc.installmentSchedule || [];
  const inst = schedule.find(i => i.installmentNumber === installmentNumber);
  if (!inst) return { success: false, error: 'Installment not found' };

  const newPaid = (inst.paidAmount || 0) + amount;
  const instStatus: InstallmentStatus = newPaid >= inst.amount ? 'PAID' : 'PARTIALLY_PAID';

  await db.collection('cvision_loans').updateOne(
    { tenantId, loanId, 'installmentSchedule.installmentNumber': installmentNumber },
    {
      $set: {
        'installmentSchedule.$.paidAmount': newPaid,
        'installmentSchedule.$.status': instStatus,
        'installmentSchedule.$.paidDate': new Date(),
        ...(payrollMonth ? { 'installmentSchedule.$.payrollMonth': payrollMonth } : {}),
        updatedAt: new Date(),
      },
      $inc: {
        totalPaid: amount,
        remainingBalance: -amount,
      },
    },
  );

  // Check if all paid
  const updated = await db.collection('cvision_loans').findOne({ tenantId, loanId }) as LoanDocument | null;
  const allPaid = (updated?.installmentSchedule || []).every(
    (i: Installment) => i.status === 'PAID',
  );
  if (allPaid) {
    await db.collection('cvision_loans').updateOne({ tenantId, loanId }, {
      $set: { status: 'PAID_OFF', actualCompletionDate: new Date(), updatedAt: new Date() },
    });
    return { success: true, loanCompleted: true };
  }

  return { success: true, loanCompleted: false };
}

/* ── Early Settlement ──────────────────────────────────────────────── */

export async function earlySettle(
  db: Db, tenantId: string, loanId: string,
): Promise<{ success: boolean; error?: string; settledAmount?: number }> {
  const loanDoc = await db.collection('cvision_loans').findOne({ tenantId, loanId }) as LoanDocument | null;
  if (!loanDoc) return { success: false, error: 'Loan not found' };
  if (loanDoc.status !== 'ACTIVE') return { success: false, error: 'Loan not in active status' };

  const remaining = loanDoc.remaining || loanDoc.remainingBalance || 0;

  const schedule: Installment[] = (loanDoc.installmentSchedule || []).map((i: Installment) => ({
    ...i,
    status: 'PAID' as InstallmentStatus,
    paidAmount: i.amount,
    paidDate: new Date(),
  }));

  await db.collection('cvision_loans').updateOne({ tenantId, loanId }, {
    $set: {
      installmentSchedule: schedule,
      totalPaid: loanDoc.totalRepayment || loanDoc.requestedAmount,
      remainingBalance: 0,
      status: 'PAID_OFF',
      actualCompletionDate: new Date(),
      updatedAt: new Date(),
    },
  });

  return { success: true, settledAmount: remaining };
}

/* ── Reschedule ────────────────────────────────────────────────────── */

export async function rescheduleLoan(
  db: Db, tenantId: string, loanId: string,
  newInstallments: number,
): Promise<{ success: boolean; error?: string }> {
  const loanDoc = await db.collection('cvision_loans').findOne({ tenantId, loanId }) as LoanDocument | null;
  if (!loanDoc) return { success: false, error: 'Loan not found' };
  if (loanDoc.status !== 'ACTIVE') return { success: false, error: 'Can only reschedule active loans' };

  const policy = LOAN_POLICIES[loanDoc.type];
  if (newInstallments > policy.maxInstallments) {
    return { success: false, error: `Maximum ${policy.maxInstallments} installments for this loan type` };
  }

  const remaining = loanDoc.remaining || loanDoc.remainingBalance || 0;
  if (remaining <= 0) return { success: false, error: 'No remaining balance' };

  const paidInstallments = (loanDoc.installmentSchedule || []).filter(
    (i: Installment) => i.status === 'PAID',
  );
  const remainingCount = newInstallments - paidInstallments.length;
  if (remainingCount < 1) return { success: false, error: 'New schedule must have at least 1 remaining installment' };

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() + 1);
  startDate.setDate(1);

  const newSchedule = [
    ...paidInstallments,
    ...generateInstallmentSchedule(remaining, remainingCount, startDate, 0),
  ];

  // Renumber
  newSchedule.forEach((s: Installment, idx: number) => { s.installmentNumber = idx + 1; });

  const expectedCompletion = new Date(startDate);
  expectedCompletion.setMonth(expectedCompletion.getMonth() + remainingCount - 1);

  await db.collection('cvision_loans').updateOne({ tenantId, loanId }, {
    $set: {
      installments: newInstallments,
      installmentSchedule: newSchedule,
      installmentAmount: Math.ceil(remaining / remainingCount),
      expectedCompletionDate: expectedCompletion,
      updatedAt: new Date(),
    },
  });

  return { success: true };
}

/* ── Summary / Dashboard Stats ─────────────────────────────────────── */

export async function getLoanSummary(db: Db, tenantId: string) {
  // Include both new-format (UPPERCASE) and old payroll-format (lowercase) statuses
  const [totalLoans, activeLoans, pendingRequests, completedLoans] = await Promise.all([
    db.collection('cvision_loans').countDocuments({ tenantId }),
    db.collection('cvision_loans').countDocuments({
      tenantId, status: 'ACTIVE',
    }),
    db.collection('cvision_loans').countDocuments({
      tenantId, status: 'PENDING',
    }),
    db.collection('cvision_loans').countDocuments({
      tenantId, status: 'PAID_OFF',
    }),
  ]);

  // Aggregate active loans
  const activeLoansData = await db.collection('cvision_loans').find({
    tenantId, status: 'ACTIVE',
  }).toArray();

  let totalDisbursed = 0;
  let totalOutstanding = 0;
  let totalPaid = 0;
  for (const raw of activeLoansData) {
    const loan = raw as LoanDocument;
    const amt = loan.principal || loan.approvedAmount || 0;
    const loanRemaining = loan.remaining || loan.remainingBalance || 0;
    const paid = amt - loanRemaining;
    totalDisbursed += amt;
    totalOutstanding += loanRemaining;
    totalPaid += paid;
  }

  // Overdue installments (only new-format loans have installmentSchedule)
  const now = new Date();
  const repayingLoans = await db.collection('cvision_loans').find({
    tenantId, status: 'ACTIVE',
  }).toArray();

  let overdueCount = 0;
  let overdueAmount = 0;
  let thisMonthDeductions = 0;
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (const raw of repayingLoans) {
    const loan = raw as LoanDocument;
    // New-format: check installment schedule
    for (const inst of (loan.installmentSchedule || [])) {
      if (inst.status === 'PENDING' && new Date(inst.dueDate) < now) {
        overdueCount++;
        overdueAmount += inst.amount - (inst.paidAmount || 0);
      }
      if (inst.payrollMonth === currentMonth && inst.status === 'PENDING') {
        thisMonthDeductions += inst.amount;
      }
    }
    // Old-format: add monthly deduction to thisMonthDeductions if no schedule exists
    if (!(loan.installmentSchedule?.length) && loan.monthlyDeduction) {
      thisMonthDeductions += loan.monthlyDeduction;
    }
  }

  return {
    totalLoans, activeLoans, pendingRequests, completedLoans,
    totalDisbursed,
    totalOutstanding,
    totalPaid,
    overdueCount, overdueAmount,
    thisMonthDeductions,
  };
}
