import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { GOSI_RATES } from '@/lib/cvision/gosi';

export interface PayslipData {
  companyName: string;
  companyAddress: string;
  commercialRegistration: string;
  employeeId: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  nationalId: string;
  bankName: string;
  iban: string;
  hireDate: string;
  month: string;
  payDate: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: { name: string; amount: number }[];
  overtime: { hours: number; rate: number; amount: number };
  totalEarnings: number;
  gosiEmployee: number;
  loanDeduction: number;
  absentDeduction: number;
  otherDeductions: { name: string; amount: number }[];
  totalDeductions: number;
  netPay: number;
  netPayWords: string;
}

export function numberToWords(num: number): string {
  if (num === 0) return 'Zero SAR';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const whole = Math.floor(Math.abs(num));
  const halalas = Math.round((Math.abs(num) - whole) * 100);

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    return convert(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + convert(n % 1000000) : '');
  }

  let result = convert(whole) + ' SAR';
  if (halalas > 0) result += ' and ' + convert(halalas) + ' Halalas';
  return result;
}

export async function generatePayslip(
  db: Db, tenantId: string, employeeId: string, month: string,
): Promise<PayslipData> {
  const employee = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId });
  if (!employee) throw new Error('Employee not found');

  const profile = await db.collection('cvision_payroll_profiles').findOne({ tenantId, employeeId });

  let payrollRecord: any = await db.collection('cvision_payslips').findOne({ tenantId, employeeId, month });
  if (!payrollRecord) {
    const dryRun = await db.collection('cvision_payroll_dry_runs')
      .find({ tenantId, month }).sort({ runDate: -1 }).limit(1).toArray();
    payrollRecord = dryRun[0]?.employees?.find((e: any) => e.employeeId === employeeId);
  }

  const tenant = await db.collection('cvision_tenants').findOne({ tenantId })
    || await db.collection('tenants').findOne({ tenantId });

  const loans = await db.collection('cvision_loans').find({
    tenantId, employeeId, status: { $in: ['active', 'ACTIVE'] },
  }).toArray();
  const loanDeduction = loans.reduce((s: number, l: any) => s + (l.monthlyDeduction || l.installmentAmount || 0), 0);

  const basic = payrollRecord?.basicSalary || profile?.baseSalary || employee.basicSalary || 0;
  const housing = payrollRecord?.housingAllowance || profile?.housingAllowance || employee.housingAllowance || 0;
  const transport = payrollRecord?.transportAllowance || profile?.transportAllowance || employee.transportAllowance || 0;
  const gosiBase = Math.min(basic + housing, GOSI_RATES.MAX_SALARY);
  const gosiEmployee = Math.round(gosiBase * GOSI_RATES.EMPLOYEE_RATE * 100) / 100;

  const otherAllowancesList: { name: string; amount: number }[] = [];
  if (employee.foodAllowance) otherAllowancesList.push({ name: 'Food Allowance', amount: employee.foodAllowance });
  if (employee.phoneAllowance) otherAllowancesList.push({ name: 'Phone Allowance', amount: employee.phoneAllowance });

  const grossPay = payrollRecord?.grossPay || (basic + housing + transport + otherAllowancesList.reduce((s, a) => s + a.amount, 0));
  const totalDeductions = gosiEmployee + loanDeduction;
  const netPay = payrollRecord?.netPay || (grossPay - totalDeductions);

  return {
    companyName: tenant?.companyName || tenant?.name || 'Company',
    companyAddress: tenant?.address || '',
    commercialRegistration: tenant?.commercialRegistration || '',
    employeeId, employeeName: employee.fullName || '',
    department: employee.department || employee.departmentName || '',
    jobTitle: employee.jobTitle || '',
    nationalId: employee.nationalId || employee.iqamaNumber || '',
    bankName: employee.bankName || profile?.bankName || '',
    iban: employee.iban || profile?.iban || '',
    hireDate: employee.hireDate || '',
    month, payDate: new Date().toISOString().split('T')[0],
    basicSalary: basic, housingAllowance: housing, transportAllowance: transport,
    otherAllowances: otherAllowancesList,
    overtime: { hours: 0, rate: 1.5, amount: 0 },
    totalEarnings: grossPay,
    gosiEmployee, loanDeduction, absentDeduction: 0,
    otherDeductions: [],
    totalDeductions, netPay,
    netPayWords: numberToWords(Math.max(0, netPay)),
  };
}

export async function generateBulkPayslips(
  db: Db, tenantId: string, month: string,
): Promise<PayslipData[]> {
  const employees = await db.collection('cvision_employees').find({
    tenantId, status: { $in: ['ACTIVE', 'ON_PROBATION', 'Active', 'Probation'] }, deletedAt: null,
  }).toArray();

  const payslips: PayslipData[] = [];
  for (const emp of employees) {
    try {
      const id = emp.id || emp.employeeId || emp._id?.toString();
      const ps = await generatePayslip(db, tenantId, id, month);
      payslips.push(ps);
    } catch { /* skip employees without data */ }
  }
  return payslips;
}
