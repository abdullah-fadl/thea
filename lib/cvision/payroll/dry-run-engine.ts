import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { GOSI_RATES } from '@/lib/cvision/gosi';

export interface DryRunEmployeeResult {
  employeeId: string;
  name: string;
  department: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  grossPay: number;
  gosiEmployee: number;
  otherDeductions: number;
  netPay: number;
  gosiEmployer: number;
  totalCost: number;
  bankName: string;
  iban: string;
  hasErrors: boolean;
}

export interface DryRunError {
  employeeId: string;
  employeeName: string;
  field: string;
  message: string;
  severity: 'ERROR' | 'CRITICAL';
}

export interface DryRunWarning {
  employeeId: string;
  employeeName: string;
  message: string;
}

export interface DryRunResult {
  tenantId: string;
  dryRunId: string;
  month: string;
  runDate: Date;
  runBy: string;
  status: 'COMPLETED' | 'ERRORS_FOUND';
  summary: {
    totalEmployees: number;
    totalGrossPay: number;
    totalDeductions: number;
    totalNetPay: number;
    totalGOSI_Employee: number;
    totalGOSI_Employer: number;
    totalCost: number;
  };
  employees: DryRunEmployeeResult[];
  errors: DryRunError[];
  warnings: DryRunWarning[];
}

async function getAttendanceDeductions(
  db: Db, tenantId: string, employeeId: string, month: string, dailySalary: number,
): Promise<{ absentDays: number; lateDays: number; deductionAmount: number }> {
  const records = await db.collection('cvision_attendance').find({
    tenantId, employeeId, date: { $regex: new RegExp(`^${month.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) },
  }).toArray();

  const absentDays = records.filter((r: any) => r.status === 'ABSENT' && !r.onApprovedLeave).length;
  const lateDays = records.filter((r: any) => (r.lateMinutes || 0) > 15).length;
  const lateDeduction = Math.floor(lateDays / 3) * dailySalary;
  const absentDeduction = absentDays * dailySalary;

  return {
    absentDays,
    lateDays,
    deductionAmount: Math.round((absentDeduction + lateDeduction) * 100) / 100,
  };
}

export async function executeDryRun(
  db: Db, tenantId: string, month: string, runBy: string,
): Promise<DryRunResult> {
  const dryRunId = `DR-${month}-${Date.now()}`;

  const employees = await db.collection('cvision_employees').find({
    tenantId, status: { $in: ['ACTIVE', 'ON_PROBATION', 'Active', 'Probation'] },
  }).toArray();

  // Also check payroll profiles
  const profiles = await db.collection('cvision_payroll_profiles').find({ tenantId }).toArray();
  const profileMap = new Map(profiles.map((p: any) => [p.employeeId, p]));

  const results: DryRunEmployeeResult[] = [];
  const errors: DryRunError[] = [];
  const warnings: DryRunWarning[] = [];

  for (const emp of employees) {
    const empId = emp.id || emp.employeeId || emp._id?.toString();
    const empName = emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown';
    const profile = profileMap.get(empId);

    const basic = profile?.baseSalary || emp.basicSalary || 0;
    const housing = profile?.housingAllowance || emp.housingAllowance || 0;
    const transport = profile?.transportAllowance || emp.transportAllowance || 0;
    const otherAllowances = (profile?.foodAllowance || emp.foodAllowance || 0)
      + (profile?.phoneAllowance || emp.phoneAllowance || 0)
      + (profile?.otherAllowances || emp.otherAllowance || 0);

    if (!basic || basic <= 0) {
      errors.push({ employeeId: empId, employeeName: empName, field: 'basicSalary', message: 'Missing or invalid basic salary', severity: 'CRITICAL' });
    }
    if (!emp.iban && !profile?.iban) {
      errors.push({ employeeId: empId, employeeName: empName, field: 'iban', message: 'Missing IBAN', severity: 'CRITICAL' });
    }
    if (!emp.bankName && !profile?.bankName) {
      errors.push({ employeeId: empId, employeeName: empName, field: 'bankName', message: 'Missing bank name', severity: 'ERROR' });
    }

    const grossPay = basic + housing + transport + otherAllowances;
    const gosiBase = Math.min(basic + housing, GOSI_RATES.MAX_SALARY);
    const gosiEmployee = Math.round(gosiBase * GOSI_RATES.EMPLOYEE_RATE * 100) / 100;
    const gosiEmployer = Math.round(gosiBase * GOSI_RATES.EMPLOYER_RATE * 100) / 100;

    const dailySalary = gosiBase / 30;
    const attendance = await getAttendanceDeductions(db, tenantId, empId, month, dailySalary);

    const advances = await db.collection('cvision_loans').find({
      tenantId, employeeId: empId, status: { $in: ['active', 'ACTIVE'] },
    }).toArray();
    const loanDeduction = advances.reduce((s: number, a: any) => s + (a.monthlyDeduction || a.installmentAmount || 0), 0);

    const otherDeductions = loanDeduction + attendance.deductionAmount;
    const netPay = grossPay - gosiEmployee - otherDeductions;

    if (netPay < 0) {
      warnings.push({ employeeId: empId, employeeName: empName, message: `Negative net pay: ${netPay.toFixed(2)} SAR` });
    }
    if (netPay > 0 && netPay < 1500) {
      warnings.push({ employeeId: empId, employeeName: empName, message: `Low net pay: ${netPay.toFixed(2)} SAR` });
    }
    if (attendance.absentDays > 3) {
      warnings.push({ employeeId: empId, employeeName: empName, message: `${attendance.absentDays} absent days` });
    }

    results.push({
      employeeId: empId, name: empName,
      department: emp.department || emp.departmentName || '',
      basicSalary: basic, housingAllowance: housing, transportAllowance: transport, otherAllowances,
      grossPay, gosiEmployee, otherDeductions, netPay: Math.max(0, netPay),
      gosiEmployer, totalCost: grossPay + gosiEmployer,
      bankName: emp.bankName || profile?.bankName || '',
      iban: emp.iban || profile?.iban || '',
      hasErrors: errors.some(e => e.employeeId === empId),
    });
  }

  const summary = {
    totalEmployees: results.length,
    totalGrossPay: Math.round(results.reduce((s, r) => s + r.grossPay, 0) * 100) / 100,
    totalDeductions: Math.round(results.reduce((s, r) => s + r.gosiEmployee + r.otherDeductions, 0) * 100) / 100,
    totalNetPay: Math.round(results.reduce((s, r) => s + r.netPay, 0) * 100) / 100,
    totalGOSI_Employee: Math.round(results.reduce((s, r) => s + r.gosiEmployee, 0) * 100) / 100,
    totalGOSI_Employer: Math.round(results.reduce((s, r) => s + r.gosiEmployer, 0) * 100) / 100,
    totalCost: Math.round(results.reduce((s, r) => s + r.totalCost, 0) * 100) / 100,
  };

  const dryRun: DryRunResult = {
    tenantId, dryRunId, month, runDate: new Date(), runBy,
    status: errors.some(e => e.severity === 'CRITICAL') ? 'ERRORS_FOUND' : 'COMPLETED',
    summary, employees: results, errors, warnings,
  };

  await db.collection('cvision_payroll_dry_runs').insertOne(dryRun);
  return dryRun;
}
