import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { GOSI_RATES } from '@/lib/cvision/gosi';

export interface DepartmentCost {
  department: string;
  headcount: number;
  totalGross: number;
  totalGOSI_Employer: number;
  totalInsurance: number;
  totalOtherBenefits: number;
  totalCost: number;
  avgCostPerEmployee: number;
  percentOfTotal: number;
}

export interface TotalCostReport {
  month: string;
  generatedAt: Date;
  summary: {
    totalGrossSalaries: number;
    totalGOSI_Employer: number;
    totalMedicalInsurance: number;
    totalOtherBenefits: number;
    totalEmployeeCost: number;
    headcount: number;
    avgCostPerEmployee: number;
  };
  byDepartment: DepartmentCost[];
  byNationality: { nationality: string; headcount: number; totalCost: number; avgCost: number }[];
  byGrade: { grade: string; headcount: number; totalCost: number; avgCost: number }[];
  budgetComparison: {
    department: string;
    budgetedAmount: number;
    actualAmount: number;
    variance: number;
    variancePercent: number;
    status: 'UNDER_BUDGET' | 'ON_BUDGET' | 'OVER_BUDGET';
  }[];
}

export async function generateTotalCostReport(
  db: Db, tenantId: string, month: string,
): Promise<TotalCostReport> {
  const employees = await db.collection('cvision_employees').find({
    tenantId, status: { $in: ['ACTIVE', 'ON_PROBATION', 'Active', 'Probation'] },
  }).toArray();

  const profiles = await db.collection('cvision_payroll_profiles').find({ tenantId }).toArray();
  const profileMap = new Map(profiles.map((p: any) => [p.employeeId, p]));

  const budgets = await db.collection('cvision_department_budgets').find({
    tenantId, year: month.split('-')[0],
  }).toArray();
  const budgetMap = new Map(budgets.map((b: any) => [b.department, b.monthlyBudget || (b.annualBudget || 0) / 12]));

  let totalGross = 0, totalGOSI = 0, totalInsurance = 0, totalBenefits = 0;
  const deptCosts = new Map<string, DepartmentCost>();
  const natCosts = new Map<string, { headcount: number; totalCost: number }>();
  const gradeCosts = new Map<string, { headcount: number; totalCost: number }>();

  for (const emp of employees) {
    const profile = profileMap.get(emp.id || emp.employeeId);
    const basic = profile?.baseSalary || emp.basicSalary || 0;
    const housing = profile?.housingAllowance || emp.housingAllowance || 0;
    const transport = profile?.transportAllowance || emp.transportAllowance || 0;
    const gross = basic + housing + transport + (emp.foodAllowance || 0) + (emp.phoneAllowance || 0);
    const gosiEmployer = Math.round(Math.min(basic + housing, GOSI_RATES.MAX_SALARY) * GOSI_RATES.EMPLOYER_RATE * 100) / 100;
    const insurance = emp.medicalInsuranceCost || 500;
    const benefits = emp.otherBenefitsCost || 0;
    const empCost = gross + gosiEmployer + insurance + benefits;

    totalGross += gross; totalGOSI += gosiEmployer; totalInsurance += insurance; totalBenefits += benefits;

    const dept = emp.department || emp.departmentName || 'Unassigned';
    if (!deptCosts.has(dept)) {
      deptCosts.set(dept, { department: dept, headcount: 0, totalGross: 0, totalGOSI_Employer: 0, totalInsurance: 0, totalOtherBenefits: 0, totalCost: 0, avgCostPerEmployee: 0, percentOfTotal: 0 });
    }
    const dc = deptCosts.get(dept)!;
    dc.headcount++; dc.totalGross += gross; dc.totalGOSI_Employer += gosiEmployer;
    dc.totalInsurance += insurance; dc.totalOtherBenefits += benefits; dc.totalCost += empCost;

    const nat = emp.nationality || 'Unknown';
    if (!natCosts.has(nat)) natCosts.set(nat, { headcount: 0, totalCost: 0 });
    natCosts.get(nat)!.headcount++; natCosts.get(nat)!.totalCost += empCost;

    const grade = emp.grade || emp.jobLevel || 'Ungraded';
    if (!gradeCosts.has(grade)) gradeCosts.set(grade, { headcount: 0, totalCost: 0 });
    gradeCosts.get(grade)!.headcount++; gradeCosts.get(grade)!.totalCost += empCost;
  }

  const totalCost = totalGross + totalGOSI + totalInsurance + totalBenefits;

  const byDepartment = Array.from(deptCosts.values()).map(dc => ({
    ...dc,
    totalGross: Math.round(dc.totalGross),
    totalCost: Math.round(dc.totalCost),
    avgCostPerEmployee: dc.headcount > 0 ? Math.round(dc.totalCost / dc.headcount) : 0,
    percentOfTotal: totalCost > 0 ? Math.round((dc.totalCost / totalCost) * 10000) / 100 : 0,
  })).sort((a, b) => b.totalCost - a.totalCost);

  const budgetComparison = byDepartment.map(dc => {
    const budget = budgetMap.get(dc.department) || 0;
    const variance = budget - dc.totalCost;
    return {
      department: dc.department,
      budgetedAmount: Math.round(budget),
      actualAmount: Math.round(dc.totalCost),
      variance: Math.round(variance),
      variancePercent: budget > 0 ? Math.round((variance / budget) * 100) : 0,
      status: (variance > budget * 0.05 ? 'UNDER_BUDGET' : variance < -budget * 0.05 ? 'OVER_BUDGET' : 'ON_BUDGET') as 'UNDER_BUDGET' | 'ON_BUDGET' | 'OVER_BUDGET',
    };
  });

  return {
    month, generatedAt: new Date(),
    summary: {
      totalGrossSalaries: Math.round(totalGross),
      totalGOSI_Employer: Math.round(totalGOSI),
      totalMedicalInsurance: Math.round(totalInsurance),
      totalOtherBenefits: Math.round(totalBenefits),
      totalEmployeeCost: Math.round(totalCost),
      headcount: employees.length,
      avgCostPerEmployee: employees.length > 0 ? Math.round(totalCost / employees.length) : 0,
    },
    byDepartment,
    byNationality: Array.from(natCosts.entries()).map(([nat, d]) => ({
      nationality: nat, ...d, avgCost: d.headcount > 0 ? Math.round(d.totalCost / d.headcount) : 0,
    })),
    byGrade: Array.from(gradeCosts.entries()).map(([grade, d]) => ({
      grade, ...d, avgCost: d.headcount > 0 ? Math.round(d.totalCost / d.headcount) : 0,
    })),
    budgetComparison,
  };
}
