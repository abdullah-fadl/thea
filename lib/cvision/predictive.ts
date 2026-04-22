/**
 * CVision Predictive Analytics Engine
 * Salary forecast, headcount forecast, absence patterns, hiring timeline, cost projection
 */
import type { Db } from '@/lib/cvision/infra/mongo-compat';

const EMP_COL = 'cvision_employees';
const ATT_COL = 'cvision_attendance';

export const MODELS = ['salaryBudgetForecast', 'headcountForecast', 'absenceForecast', 'hiringTimeline', 'costForecast'] as const;

export async function salaryForecast(db: Db, tenantId: string, params: any = {}): Promise<any> {
  const employees = await db.collection(EMP_COL).find({ tenantId, status: 'ACTIVE' }).toArray();
  const totalSalary = employees.reduce((s: number, e: any) => s + (e.basicSalary || e.salary || 0), 0);
  const avgIncrement = params.avgIncrement || 5; // 5%
  const plannedHires = params.plannedHires || 0;
  const avgNewSalary = totalSalary / (employees.length || 1);
  const months = [];
  let running = totalSalary;
  for (let i = 1; i <= 12; i++) {
    const monthlyIncrease = (running * (avgIncrement / 100)) / 12;
    const hireAddition = (plannedHires / 12) * avgNewSalary;
    running += monthlyIncrease + hireAddition;
    months.push({ month: i, projected: Math.round(running), current: totalSalary });
  }
  return { currentMonthlyCost: totalSalary, projectedAnnualCost: Math.round(running * 12), monthlyForecast: months, headcount: employees.length };
}

export async function headcountForecast(db: Db, tenantId: string, params: any = {}): Promise<any> {
  const current = await db.collection(EMP_COL).countDocuments({ tenantId, status: 'ACTIVE' });
  const turnoverRate = params.turnoverRate || 10; // 10%
  const growthRate = params.growthRate || 5; // 5%
  const months = [];
  let count = current;
  for (let i = 1; i <= 12; i++) {
    const attrition = Math.round(count * (turnoverRate / 100) / 12);
    const growth = Math.round(count * (growthRate / 100) / 12);
    count = count - attrition + growth;
    months.push({ month: i, projected: count, attrition, newHires: growth });
  }
  return { currentHeadcount: current, projectedYear: count, monthlyForecast: months };
}

export async function absenceForecast(db: Db, tenantId: string, params: any = {}): Promise<any> {
  const total = await db.collection(EMP_COL).countDocuments({ tenantId, status: 'ACTIVE' });
  // Simulated seasonal patterns
  const seasonalRates: Record<number, number> = { 1: 5, 2: 4, 3: 8, 4: 15, 5: 6, 6: 8, 7: 12, 8: 10, 9: 5, 10: 4, 11: 4, 12: 6 }; // Ramadan month 3-4 higher
  const months = [];
  for (let i = 1; i <= 12; i++) {
    const rate = seasonalRates[i] || 5;
    months.push({ month: i, predictedAbsent: Math.round(total * rate / 100), rate });
  }
  return { totalActive: total, monthlyForecast: months };
}

export async function hiringTimeline(db: Db, tenantId: string, params: any = {}): Promise<any> {
  // Average days to fill by level
  const baselines: Record<string, number> = { JUNIOR: 21, MID: 35, SENIOR: 50, MANAGER: 65, DIRECTOR: 90 };
  const level = params.level || 'MID';
  const base = baselines[level] || 35;
  const departmentFactor = params.department === 'IT' ? 1.3 : params.department === 'SALES' ? 0.8 : 1;
  return { level, estimatedDays: Math.round(base * departmentFactor), confidence: 0.75, breakdown: { sourcing: Math.round(base * 0.3), screening: Math.round(base * 0.2), interviews: Math.round(base * 0.3), offer: Math.round(base * 0.2) } };
}

export async function costForecast(db: Db, tenantId: string, params: any = {}): Promise<any> {
  const employees = await db.collection(EMP_COL).find({ tenantId, status: 'ACTIVE' }).toArray();
  const totalSalary = employees.reduce((s: number, e: any) => s + (e.basicSalary || e.salary || 0), 0);
  const benefits = totalSalary * 0.15;
  const insurance = employees.length * 500;
  const training = employees.length * 200;
  const months = [];
  for (let i = 1; i <= 12; i++) {
    months.push({ month: i, salaries: totalSalary, benefits: Math.round(benefits), insurance: Math.round(insurance), training: Math.round(training), total: Math.round(totalSalary + benefits + insurance + training) });
  }
  return { monthlyCost: Math.round(totalSalary + benefits + insurance + training), annualProjected: Math.round((totalSalary + benefits + insurance + training) * 12), breakdown: { salaries: totalSalary, benefits: Math.round(benefits), insurance: Math.round(insurance), training: Math.round(training) }, monthlyForecast: months };
}

export async function getDashboard(db: Db, tenantId: string): Promise<any> {
  const salaryRaw = await salaryForecast(db, tenantId);
  const headcountRaw = await headcountForecast(db, tenantId);
  const absenceRaw = await absenceForecast(db, tenantId);
  const costRaw = await costForecast(db, tenantId);
  // Map to dashboard-expected shape
  const avgAbsenceRate = absenceRaw.monthlyForecast?.length
    ? absenceRaw.monthlyForecast.reduce((s: number, m: any) => s + (m.rate || 0), 0) / absenceRaw.monthlyForecast.length
    : 5;
  return {
    salary: {
      currentMonthly: salaryRaw.currentMonthlyCost || 0,
      projectedAnnual: salaryRaw.projectedAnnualCost || 0,
      changePercent: salaryRaw.currentMonthlyCost ? Math.round(((salaryRaw.projectedAnnualCost / 12) - salaryRaw.currentMonthlyCost) / salaryRaw.currentMonthlyCost * 100) : 0,
    },
    headcount: {
      current: headcountRaw.currentHeadcount || 0,
      projected: headcountRaw.projectedYear || 0,
      changePercent: headcountRaw.currentHeadcount ? Math.round(((headcountRaw.projectedYear || 0) - headcountRaw.currentHeadcount) / headcountRaw.currentHeadcount * 100) : 0,
    },
    absence: {
      currentRate: avgAbsenceRate,
      predictedRate: avgAbsenceRate,
      totalActive: absenceRaw.totalActive || 0,
    },
    cost: {
      monthlyCost: costRaw.monthlyCost || 0,
      annualProjected: costRaw.annualProjected || 0,
      changePercent: costRaw.monthlyCost ? Math.round(((costRaw.annualProjected / 12) - costRaw.monthlyCost) / costRaw.monthlyCost * 100) : 0,
    },
  };
}

export async function runForecast(db: Db, tenantId: string, model: string, params: any = {}): Promise<any> {
  switch (model) {
    case 'salaryBudgetForecast': return salaryForecast(db, tenantId, params);
    case 'headcountForecast': return headcountForecast(db, tenantId, params);
    case 'absenceForecast': return absenceForecast(db, tenantId, params);
    case 'hiringTimeline': return hiringTimeline(db, tenantId, params);
    case 'costForecast': return costForecast(db, tenantId, params);
    default: return { error: 'Unknown model' };
  }
}
