import type { Db } from '@/lib/cvision/infra/mongo-compat';

interface PayrollRecord {
  employeeId: string;
  name?: string;
  employeeName?: string;
  department?: string;
  grossPay?: number;
  grossSalary?: number;
  netPay?: number;
  netSalary?: number;
  totalCost?: number;
  gosiEmployee?: number;
  gosiEmployer?: number;
  otherDeductions?: number;
  [key: string]: unknown;
}

export interface PayrollComparison {
  month1: string;
  month2: string;
  summary: { field: string; month1Value: number; month2Value: number; change: number; changePercent: number }[];
  newHires: { employeeId: string; name: string; department: string; netPay: number }[];
  terminations: { employeeId: string; name: string; department: string; lastPay: number }[];
  salaryChanges: { employeeId: string; name: string; department: string; oldGross: number; newGross: number; change: number; reason: string }[];
  departmentComparison: { department: string; month1Total: number; month2Total: number; change: number; changePercent: number; month1Headcount: number; month2Headcount: number }[];
}

async function getRecords(db: Db, tenantId: string, month: string): Promise<PayrollRecord[]> {
  // Try finalized payslips first, then dry runs
  const payslips = await db.collection('cvision_payslips').find({ tenantId, month }).toArray();
  if (payslips.length > 0) return payslips;

  const dryRun = await db.collection('cvision_payroll_dry_runs')
    .find({ tenantId, month }).sort({ runDate: -1 }).limit(1).toArray();
  return dryRun[0]?.employees || [];
}

export async function comparePayrollMonths(
  db: Db, tenantId: string, month1: string, month2: string,
): Promise<PayrollComparison> {
  const records1 = await getRecords(db, tenantId, month1);
  const records2 = await getRecords(db, tenantId, month2);

  const empMap1 = new Map(records1.map((r) => [r.employeeId, r]));
  const empMap2 = new Map(records2.map((r) => [r.employeeId, r]));

  const newHires = records2
    .filter((r) => !empMap1.has(r.employeeId))
    .map((r) => ({ employeeId: r.employeeId, name: r.name || r.employeeName || '', department: r.department || '', netPay: r.netPay || r.netSalary || 0 }));

  const terminations = records1
    .filter((r) => !empMap2.has(r.employeeId))
    .map((r) => ({ employeeId: r.employeeId, name: r.name || r.employeeName || '', department: r.department || '', lastPay: r.netPay || r.netSalary || 0 }));

  const salaryChanges: PayrollComparison['salaryChanges'] = [];
  for (const [empId, rec2] of empMap2) {
    const rec1 = empMap1.get(empId);
    if (!rec1) continue;
    const g1 = rec1.grossPay || rec1.grossSalary || 0;
    const g2 = rec2.grossPay || rec2.grossSalary || 0;
    if (Math.abs(g1 - g2) > 1) {
      salaryChanges.push({
        employeeId: empId,
        name: rec2.name || rec2.employeeName || '',
        department: rec2.department || '',
        oldGross: g1, newGross: g2, change: g2 - g1,
        reason: g2 > g1 ? 'Increase' : 'Decrease',
      });
    }
  }

  const calcTotal = (recs: PayrollRecord[], field: string) => recs.reduce((s: number, r: PayrollRecord) => s + (Number(r[field]) || 0), 0);
  const fields = ['grossPay', 'netPay', 'gosiEmployee', 'gosiEmployer', 'otherDeductions', 'totalCost'];
  const summary = fields.map(field => {
    const v1 = calcTotal(records1, field);
    const v2 = calcTotal(records2, field);
    return { field, month1Value: Math.round(v1), month2Value: Math.round(v2), change: Math.round(v2 - v1), changePercent: v1 > 0 ? Math.round(((v2 - v1) / v1) * 10000) / 100 : 0 };
  });

  const deptMap1 = new Map<string, { total: number; count: number }>();
  const deptMap2 = new Map<string, { total: number; count: number }>();
  for (const r of records1) { const d = r.department || 'Unassigned'; const e = deptMap1.get(d) || { total: 0, count: 0 }; e.total += r.totalCost || r.grossPay || 0; e.count++; deptMap1.set(d, e); }
  for (const r of records2) { const d = r.department || 'Unassigned'; const e = deptMap2.get(d) || { total: 0, count: 0 }; e.total += r.totalCost || r.grossPay || 0; e.count++; deptMap2.set(d, e); }

  const allDepts = new Set([...deptMap1.keys(), ...deptMap2.keys()]);
  const departmentComparison = Array.from(allDepts).map(dept => {
    const d1 = deptMap1.get(dept) || { total: 0, count: 0 };
    const d2 = deptMap2.get(dept) || { total: 0, count: 0 };
    return {
      department: dept, month1Total: Math.round(d1.total), month2Total: Math.round(d2.total),
      change: Math.round(d2.total - d1.total),
      changePercent: d1.total > 0 ? Math.round(((d2.total - d1.total) / d1.total) * 100) : 0,
      month1Headcount: d1.count, month2Headcount: d2.count,
    };
  });

  return { month1, month2, summary, newHires, terminations, salaryChanges, departmentComparison };
}
