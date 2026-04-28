import type { Db } from '@/lib/cvision/infra/mongo-compat';

export interface JournalLine {
  accountCode: string;
  accountName: string;
  department?: string;
  costCenter?: string;
  debit: number;
  credit: number;
  description: string;
}

export interface JournalEntry {
  entryId: string;
  date: string;
  description: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  reference: string;
  status: 'DRAFT' | 'POSTED';
}

export const DEFAULT_GL_MAPPING: Record<string, { code: string; name: string }> = {
  SALARY_EXPENSE:          { code: '5100', name: 'Salaries & Wages Expense' },
  HOUSING_ALLOWANCE_EXP:   { code: '5110', name: 'Housing Allowance Expense' },
  TRANSPORT_ALLOWANCE_EXP: { code: '5120', name: 'Transport Allowance Expense' },
  OTHER_ALLOWANCE_EXP:     { code: '5130', name: 'Other Allowances Expense' },
  GOSI_EMPLOYER_EXP:       { code: '5200', name: 'GOSI Employer Contribution Expense' },
  MEDICAL_INSURANCE_EXP:   { code: '5210', name: 'Medical Insurance Expense' },
  SALARY_PAYABLE:          { code: '2100', name: 'Salaries Payable' },
  GOSI_EMPLOYEE_PAYABLE:   { code: '2110', name: 'GOSI Employee Contribution Payable' },
  GOSI_EMPLOYER_PAYABLE:   { code: '2120', name: 'GOSI Employer Contribution Payable' },
  LOAN_RECEIVABLE:         { code: '1300', name: 'Employee Loans Receivable' },
  OTHER_DEDUCTIONS_PAYABLE:{ code: '2130', name: 'Other Deductions Payable' },
  BANK_ACCOUNT:            { code: '1010', name: 'Bank Account - Payroll' },
};

export async function generatePayrollJournalEntry(
  db: Db, tenantId: string, month: string,
): Promise<JournalEntry> {
  const customMapping = await db.collection('cvision_gl_mapping').findOne({ tenantId });
  const gl = customMapping?.mapping || DEFAULT_GL_MAPPING;

  // Gather data from dry runs or payslips
  let records: any[] = await db.collection('cvision_payslips').find({ tenantId, month }).toArray();
  if (records.length === 0) {
    const dryRun = await db.collection('cvision_payroll_dry_runs')
      .find({ tenantId, month }).sort({ runDate: -1 }).limit(1).toArray();
    records = dryRun[0]?.employees || [];
  }

  const deptTotals = new Map<string, {
    basicSalary: number; housing: number; transport: number; otherAllow: number;
    gosiEmployee: number; gosiEmployer: number; loanDeductions: number; otherDeductions: number; netPay: number;
  }>();

  for (const rec of records) {
    const dept = rec.department || 'General';
    if (!deptTotals.has(dept)) {
      deptTotals.set(dept, { basicSalary: 0, housing: 0, transport: 0, otherAllow: 0, gosiEmployee: 0, gosiEmployer: 0, loanDeductions: 0, otherDeductions: 0, netPay: 0 });
    }
    const d = deptTotals.get(dept)!;
    d.basicSalary += rec.basicSalary || 0;
    d.housing += rec.housingAllowance || 0;
    d.transport += rec.transportAllowance || 0;
    d.otherAllow += rec.otherAllowances || 0;
    d.gosiEmployee += rec.gosiEmployee || 0;
    d.gosiEmployer += rec.gosiEmployer || 0;
    d.loanDeductions += rec.loanDeduction || 0;
    d.netPay += rec.netPay || 0;
  }

  const lines: JournalLine[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const [dept, t] of deptTotals) {
    if (t.basicSalary > 0) { const a = round(t.basicSalary); lines.push({ accountCode: gl.SALARY_EXPENSE.code, accountName: gl.SALARY_EXPENSE.name, department: dept, debit: a, credit: 0, description: `Basic Salary - ${dept}` }); totalDebit += a; }
    if (t.housing > 0) { const a = round(t.housing); lines.push({ accountCode: gl.HOUSING_ALLOWANCE_EXP.code, accountName: gl.HOUSING_ALLOWANCE_EXP.name, department: dept, debit: a, credit: 0, description: `Housing Allowance - ${dept}` }); totalDebit += a; }
    if (t.transport > 0) { const a = round(t.transport); lines.push({ accountCode: gl.TRANSPORT_ALLOWANCE_EXP.code, accountName: gl.TRANSPORT_ALLOWANCE_EXP.name, department: dept, debit: a, credit: 0, description: `Transport Allowance - ${dept}` }); totalDebit += a; }
    if (t.otherAllow > 0) { const a = round(t.otherAllow); lines.push({ accountCode: gl.OTHER_ALLOWANCE_EXP.code, accountName: gl.OTHER_ALLOWANCE_EXP.name, department: dept, debit: a, credit: 0, description: `Other Allowances - ${dept}` }); totalDebit += a; }
    if (t.gosiEmployer > 0) { const a = round(t.gosiEmployer); lines.push({ accountCode: gl.GOSI_EMPLOYER_EXP.code, accountName: gl.GOSI_EMPLOYER_EXP.name, department: dept, debit: a, credit: 0, description: `GOSI Employer - ${dept}` }); totalDebit += a; }
  }

  const totalNetPay = round(Array.from(deptTotals.values()).reduce((s, d) => s + d.netPay, 0));
  const totalGOSIEmp = round(Array.from(deptTotals.values()).reduce((s, d) => s + d.gosiEmployee, 0));
  const totalGOSIEr = round(Array.from(deptTotals.values()).reduce((s, d) => s + d.gosiEmployer, 0));
  const totalLoans = round(Array.from(deptTotals.values()).reduce((s, d) => s + d.loanDeductions, 0));

  lines.push({ accountCode: gl.SALARY_PAYABLE.code, accountName: gl.SALARY_PAYABLE.name, debit: 0, credit: totalNetPay, description: 'Net Salaries Payable' });
  totalCredit += totalNetPay;

  if (totalGOSIEmp > 0) { lines.push({ accountCode: gl.GOSI_EMPLOYEE_PAYABLE.code, accountName: gl.GOSI_EMPLOYEE_PAYABLE.name, debit: 0, credit: totalGOSIEmp, description: 'GOSI Employee Payable' }); totalCredit += totalGOSIEmp; }
  if (totalGOSIEr > 0) { lines.push({ accountCode: gl.GOSI_EMPLOYER_PAYABLE.code, accountName: gl.GOSI_EMPLOYER_PAYABLE.name, debit: 0, credit: totalGOSIEr, description: 'GOSI Employer Payable' }); totalCredit += totalGOSIEr; }
  if (totalLoans > 0) { lines.push({ accountCode: gl.LOAN_RECEIVABLE.code, accountName: gl.LOAN_RECEIVABLE.name, debit: 0, credit: totalLoans, description: 'Employee Loan Repayments' }); totalCredit += totalLoans; }

  const diff = round(totalDebit - totalCredit);
  if (Math.abs(diff) > 0.01) {
    if (diff > 0) { lines.push({ accountCode: '5999', accountName: 'Rounding Adjustment', debit: 0, credit: diff, description: 'Rounding' }); totalCredit += diff; }
    else { lines.push({ accountCode: '5999', accountName: 'Rounding Adjustment', debit: Math.abs(diff), credit: 0, description: 'Rounding' }); totalDebit += Math.abs(diff); }
  }

  const entry: JournalEntry = {
    entryId: `JE-PAY-${month}`, date: new Date().toISOString().split('T')[0],
    description: `Payroll Journal Entry for ${month}`,
    lines, totalDebit: round(totalDebit), totalCredit: round(totalCredit),
    reference: month, status: 'DRAFT',
  };

  await db.collection('cvision_journal_entries').updateOne(
    { tenantId, reference: month, description: { $regex: /Payroll/ } },
    { $set: { ...entry, tenantId, updatedAt: new Date() } },
    { upsert: true },
  );

  return entry;
}

export function formatJournalForExport(entry: JournalEntry): string {
  const headers = 'Entry ID,Date,Account Code,Account Name,Department,Debit,Credit,Description';
  const rows = entry.lines.map(l =>
    `${entry.entryId},${entry.date},${l.accountCode},${l.accountName},${l.department || ''},${l.debit || ''},${l.credit || ''},${l.description}`
  );
  return [headers, ...rows].join('\n');
}

function round(n: number): number { return Math.round(n * 100) / 100; }
