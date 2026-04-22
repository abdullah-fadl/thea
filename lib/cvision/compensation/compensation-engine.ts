import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { GOSI_RATES } from '@/lib/cvision/gosi';

/* ── Types ─────────────────────────────────────────────────────────── */

export type AllowanceType = 'PERCENTAGE' | 'FIXED';
export type InsuranceClass = 'VIP' | 'A' | 'B' | 'C';
export type FlightClass = 'FIRST' | 'BUSINESS' | 'ECONOMY';
export type SalaryChangeReason = 'HIRE' | 'PROMOTION' | 'ANNUAL_INCREMENT' | 'MARKET_ADJUSTMENT' | 'PERFORMANCE' | 'RESTRUCTURE';
export type RangePosition = 'BELOW_MIN' | 'LOWER_THIRD' | 'MIDDLE_THIRD' | 'UPPER_THIRD' | 'ABOVE_MAX';

export const REASON_LABELS: Record<SalaryChangeReason, string> = {
  HIRE: 'Initial Hire', PROMOTION: 'Promotion', ANNUAL_INCREMENT: 'Annual Increment',
  MARKET_ADJUSTMENT: 'Market Adjustment', PERFORMANCE: 'Performance', RESTRUCTURE: 'Restructure',
};

export const INSURANCE_CLASS_LABELS: Record<InsuranceClass, string> = {
  VIP: 'VIP — Executive', A: 'A — Gold', B: 'B — Silver', C: 'C — Bronze',
};

export const INSURANCE_CLASS_COST: Record<InsuranceClass, number> = {
  VIP: 1500, A: 750, B: 450, C: 250,
};

/* ── Helpers ───────────────────────────────────────────────────────── */

export function computeCompaRatio(basic: number, midpoint: number): number {
  if (midpoint <= 0) return 0;
  return Math.round((basic / midpoint) * 10000) / 100;
}

export function computeRangePosition(basic: number, min: number, max: number): RangePosition {
  if (basic < min) return 'BELOW_MIN';
  if (basic > max) return 'ABOVE_MAX';
  const range = max - min;
  if (range <= 0) return 'MIDDLE_THIRD';
  const pct = ((basic - min) / range) * 100;
  if (pct < 33.33) return 'LOWER_THIRD';
  if (pct < 66.67) return 'MIDDLE_THIRD';
  return 'UPPER_THIRD';
}

export function computeAllowanceAmount(basic: number, type: AllowanceType, value: number): number {
  return type === 'PERCENTAGE' ? Math.round(basic * value / 100) : value;
}

export function computeGrossFromGrade(basic: number, grade: any): {
  allowances: Record<string, number>; totalAllowances: number; gross: number;
} {
  const all = grade?.allowances;
  if (!all) return { allowances: {}, totalAllowances: 0, gross: basic };

  const housing = computeAllowanceAmount(basic, all.housing?.type || 'PERCENTAGE', all.housing?.value || 0);
  const transport = computeAllowanceAmount(basic, all.transport?.type || 'PERCENTAGE', all.transport?.value || 0);
  const phone = computeAllowanceAmount(basic, all.phone?.type || 'FIXED', all.phone?.value || 0);
  const food = computeAllowanceAmount(basic, all.food?.type || 'FIXED', all.food?.value || 0);
  const education = computeAllowanceAmount(basic, all.education?.type || 'FIXED', all.education?.value || 0);
  const remote = computeAllowanceAmount(basic, all.remote?.type || 'FIXED', all.remote?.value || 0);

  let otherTotal = 0;
  for (const o of all.other || []) {
    otherTotal += computeAllowanceAmount(basic, o.type || 'FIXED', o.value || 0);
  }

  const totalAllowances = housing + transport + phone + food + education + remote + otherTotal;

  return {
    allowances: { housing, transport, phone, food, education, remote },
    totalAllowances,
    gross: basic + totalAllowances,
  };
}

export function computeDeductions(gross: number, insuranceClass: InsuranceClass, loanRepayment: number = 0): {
  gosiEmployee: number; insurance: number; loanRepayment: number; totalDeductions: number; net: number;
} {
  const gosiEmployee = Math.round(gross * GOSI_RATES.EMPLOYEE_RATE);
  const insurance = INSURANCE_CLASS_COST[insuranceClass] || 0;
  const totalDeductions = gosiEmployee + insurance + loanRepayment;
  return { gosiEmployee, insurance, loanRepayment, totalDeductions, net: gross - totalDeductions };
}

export function computeTotalCompensation(basic: number, grade: any, insuranceClass: InsuranceClass): {
  annualBasic: number; annualAllowances: number; annualBonus: number; insuranceValue: number;
  gosiEmployer: number; trainingBudget: number; otherBenefits: number; totalAnnual: number;
} {
  const { totalAllowances, gross } = computeGrossFromGrade(basic, grade);
  const annualBasic = basic * 12;
  const annualAllowances = totalAllowances * 12;
  const bonusMonths = grade?.bonusStructure?.annualBonusMonths || 0;
  const annualBonus = gross * bonusMonths;
  const insuranceValue = (INSURANCE_CLASS_COST[insuranceClass] || 0) * 12;
  const gosiEmployer = Math.round(gross * GOSI_RATES.EMPLOYER_RATE) * 12;
  const trainingBudget = 5000;
  const flights = (grade?.benefits?.annualTickets || 0) * 3000;
  const otherBenefits = flights;
  const totalAnnual = annualBasic + annualAllowances + annualBonus + insuranceValue + gosiEmployer + trainingBudget + otherBenefits;
  return { annualBasic, annualAllowances, annualBonus, insuranceValue, gosiEmployer, trainingBudget, otherBenefits, totalAnnual };
}

/* ── Seed Data ─────────────────────────────────────────────────────── */

const SEED_GRADES = [
  {
    gradeId: 'GRD-01', gradeName: 'Junior Staff', level: 1,
    range: { minimum: 4000, midpoint: 5000, maximum: 6000, currency: 'SAR' },
    allowances: {
      housing: { type: 'PERCENTAGE', value: 25 }, transport: { type: 'FIXED', value: 500 },
      phone: { type: 'FIXED', value: 200 }, food: { type: 'FIXED', value: 300 },
      education: { type: 'FIXED', value: 0 }, remote: { type: 'FIXED', value: 0 }, other: [],
    },
    benefits: { insuranceClass: 'C', flightClass: 'ECONOMY', annualTickets: 1, annualLeave: 21, endOfServiceMultiplier: 0.5 },
    bonusStructure: { annualBonusMonths: 0, performanceBonus: false, commissionEligible: false },
    effectiveDate: new Date('2026-01-01'), status: 'ACTIVE',
  },
  {
    gradeId: 'GRD-02', gradeName: 'Staff', level: 3,
    range: { minimum: 6000, midpoint: 7500, maximum: 9000, currency: 'SAR' },
    allowances: {
      housing: { type: 'PERCENTAGE', value: 25 }, transport: { type: 'FIXED', value: 700 },
      phone: { type: 'FIXED', value: 300 }, food: { type: 'FIXED', value: 400 },
      education: { type: 'FIXED', value: 0 }, remote: { type: 'FIXED', value: 0 }, other: [],
    },
    benefits: { insuranceClass: 'C', flightClass: 'ECONOMY', annualTickets: 1, annualLeave: 21, endOfServiceMultiplier: 0.5 },
    bonusStructure: { annualBonusMonths: 0.5, performanceBonus: true, commissionEligible: false },
    effectiveDate: new Date('2026-01-01'), status: 'ACTIVE',
  },
  {
    gradeId: 'GRD-03', gradeName: 'Senior Staff', level: 5,
    range: { minimum: 9000, midpoint: 11000, maximum: 13000, currency: 'SAR' },
    allowances: {
      housing: { type: 'PERCENTAGE', value: 25 }, transport: { type: 'FIXED', value: 1000 },
      phone: { type: 'FIXED', value: 400 }, food: { type: 'FIXED', value: 500 },
      education: { type: 'FIXED', value: 500 }, remote: { type: 'FIXED', value: 300 }, other: [],
    },
    benefits: { insuranceClass: 'B', flightClass: 'ECONOMY', annualTickets: 2, annualLeave: 25, endOfServiceMultiplier: 1 },
    bonusStructure: { annualBonusMonths: 1, performanceBonus: true, commissionEligible: false },
    effectiveDate: new Date('2026-01-01'), status: 'ACTIVE',
  },
  {
    gradeId: 'GRD-04', gradeName: 'Manager', level: 8,
    range: { minimum: 13000, midpoint: 16000, maximum: 19000, currency: 'SAR' },
    allowances: {
      housing: { type: 'PERCENTAGE', value: 25 }, transport: { type: 'FIXED', value: 1500 },
      phone: { type: 'FIXED', value: 500 }, food: { type: 'FIXED', value: 500 },
      education: { type: 'FIXED', value: 1000 }, remote: { type: 'FIXED', value: 500 }, other: [],
    },
    benefits: { insuranceClass: 'A', flightClass: 'BUSINESS', annualTickets: 2, annualLeave: 28, endOfServiceMultiplier: 1 },
    bonusStructure: { annualBonusMonths: 1.5, performanceBonus: true, commissionEligible: false },
    effectiveDate: new Date('2026-01-01'), status: 'ACTIVE',
  },
  {
    gradeId: 'GRD-05', gradeName: 'Senior Manager', level: 10,
    range: { minimum: 19000, midpoint: 23000, maximum: 27000, currency: 'SAR' },
    allowances: {
      housing: { type: 'PERCENTAGE', value: 25 }, transport: { type: 'FIXED', value: 2000 },
      phone: { type: 'FIXED', value: 700 }, food: { type: 'FIXED', value: 500 },
      education: { type: 'FIXED', value: 1500 }, remote: { type: 'FIXED', value: 500 }, other: [],
    },
    benefits: { insuranceClass: 'A', flightClass: 'BUSINESS', annualTickets: 2, annualLeave: 30, endOfServiceMultiplier: 1 },
    bonusStructure: { annualBonusMonths: 2, performanceBonus: true, commissionEligible: false },
    effectiveDate: new Date('2026-01-01'), status: 'ACTIVE',
  },
  {
    gradeId: 'GRD-06', gradeName: 'Director', level: 13,
    range: { minimum: 27000, midpoint: 33000, maximum: 39000, currency: 'SAR' },
    allowances: {
      housing: { type: 'PERCENTAGE', value: 25 }, transport: { type: 'FIXED', value: 3000 },
      phone: { type: 'FIXED', value: 1000 }, food: { type: 'FIXED', value: 500 },
      education: { type: 'FIXED', value: 2000 }, remote: { type: 'FIXED', value: 500 },
      other: [{ name: 'Car Allowance', type: 'FIXED' as const, value: 3000 }],
    },
    benefits: { insuranceClass: 'VIP', flightClass: 'BUSINESS', annualTickets: 3, annualLeave: 30, endOfServiceMultiplier: 1 },
    bonusStructure: { annualBonusMonths: 3, performanceBonus: true, commissionEligible: false },
    effectiveDate: new Date('2026-01-01'), status: 'ACTIVE',
  },
  {
    gradeId: 'GRD-07', gradeName: 'VP / Executive', level: 16,
    range: { minimum: 39000, midpoint: 48000, maximum: 57000, currency: 'SAR' },
    allowances: {
      housing: { type: 'PERCENTAGE', value: 30 }, transport: { type: 'FIXED', value: 5000 },
      phone: { type: 'FIXED', value: 1500 }, food: { type: 'FIXED', value: 500 },
      education: { type: 'FIXED', value: 3000 }, remote: { type: 'FIXED', value: 1000 },
      other: [{ name: 'Car Allowance', type: 'FIXED' as const, value: 5000 }, { name: 'Representation', type: 'FIXED' as const, value: 2000 }],
    },
    benefits: { insuranceClass: 'VIP', flightClass: 'FIRST', annualTickets: 4, annualLeave: 30, endOfServiceMultiplier: 1 },
    bonusStructure: { annualBonusMonths: 4, performanceBonus: true, commissionEligible: true },
    effectiveDate: new Date('2026-01-01'), status: 'ACTIVE',
  },
];

const SEED_EMPLOYEE_COMP = [
  { employeeId: 'EMP-001', employeeName: 'Ahmed Al-Rashidi', gradeId: 'GRD-04', basicSalary: 15000, department: 'IT' },
  { employeeId: 'EMP-002', employeeName: 'Sara Hassan', gradeId: 'GRD-03', basicSalary: 10500, department: 'Finance' },
  { employeeId: 'EMP-003', employeeName: 'Mohammed Al-Harbi', gradeId: 'GRD-03', basicSalary: 11000, department: 'IT' },
  { employeeId: 'EMP-004', employeeName: 'Fahad Al-Qahtani', gradeId: 'GRD-05', basicSalary: 22000, department: 'Operations' },
  { employeeId: 'EMP-005', employeeName: 'Khalid Al-Dosari', gradeId: 'GRD-02', basicSalary: 7000, department: 'Operations' },
  { employeeId: 'EMP-006', employeeName: 'Noura Al-Shehri', gradeId: 'GRD-04', basicSalary: 14000, department: 'HR' },
  { employeeId: 'EMP-007', employeeName: 'Ali Al-Mutairi', gradeId: 'GRD-02', basicSalary: 8000, department: 'Operations' },
];

export async function ensureSeedData(db: Db, tenantId: string): Promise<void> {
  const structColl = db.collection('cvision_salary_structure');
  const count = await structColl.countDocuments({ tenantId });
  if (count > 0) return;

  const now = new Date();
  await structColl.insertMany(SEED_GRADES.map(g => ({ ...g, tenantId, createdAt: now, updatedAt: now })));

  const gradeMap = new Map(SEED_GRADES.map(g => [g.gradeId, g]));
  const compColl = db.collection('cvision_employee_compensation');
  const compDocs = SEED_EMPLOYEE_COMP.map(emp => {
    const grade = gradeMap.get(emp.gradeId)!;
    const { allowances, totalAllowances, gross } = computeGrossFromGrade(emp.basicSalary, grade);
    const insClass = (grade.benefits?.insuranceClass || 'B') as InsuranceClass;
    const ded = computeDeductions(gross, insClass);
    const tc = computeTotalCompensation(emp.basicSalary, grade, insClass);
    const compaRatio = computeCompaRatio(emp.basicSalary, grade.range.midpoint);
    const rangePosition = computeRangePosition(emp.basicSalary, grade.range.minimum, grade.range.maximum);

    return {
      tenantId, employeeId: emp.employeeId, employeeName: emp.employeeName, gradeId: emp.gradeId,
      basicSalary: emp.basicSalary,
      allowances: { ...allowances, other: [], totalAllowances },
      grossSalary: gross,
      deductions: { gosiEmployee: ded.gosiEmployee, insurance: ded.insurance, loanRepayment: 0, other: [], totalDeductions: ded.totalDeductions },
      netSalary: ded.net,
      compaRatio, rangePosition,
      totalCompensation: tc,
      salaryHistory: [{ date: new Date('2026-01-01'), oldBasic: 0, newBasic: emp.basicSalary, reason: 'HIRE' as SalaryChangeReason, approvedBy: 'SYSTEM', percentage: 0 }],
      effectiveDate: new Date('2026-01-01'), updatedAt: now,
    };
  });
  await compColl.insertMany(compDocs);
}

/* ── Analytics ─────────────────────────────────────────────────────── */

export async function getCompensationSummary(db: Db, tenantId: string) {
  const compColl = db.collection('cvision_employee_compensation');
  const all = await compColl.find({ tenantId }).toArray();
  if (all.length === 0) return { totalEmployees: 0, avgBasic: 0, avgGross: 0, totalMonthlyPayroll: 0, totalAnnualCost: 0, compaRatioDistribution: [], bandDistribution: [] };

  const totalBasic = all.reduce((s, c) => s + (c.basicSalary || 0), 0);
  const totalGross = all.reduce((s, c) => s + (c.grossSalary || 0), 0);
  const totalAnnual = all.reduce((s, c) => s + (c.totalCompensation?.totalAnnual || 0), 0);

  const bandDist: Record<string, number> = {};
  const compaGroups: Record<string, number> = { 'Below 80%': 0, '80-90%': 0, '90-100%': 0, '100-110%': 0, '110-120%': 0, 'Above 120%': 0 };

  for (const c of all) {
    bandDist[c.rangePosition || 'UNKNOWN'] = (bandDist[c.rangePosition || 'UNKNOWN'] || 0) + 1;
    const cr = c.compaRatio || 0;
    if (cr < 80) compaGroups['Below 80%']++;
    else if (cr < 90) compaGroups['80-90%']++;
    else if (cr < 100) compaGroups['90-100%']++;
    else if (cr < 110) compaGroups['100-110%']++;
    else if (cr < 120) compaGroups['110-120%']++;
    else compaGroups['Above 120%']++;
  }

  return {
    totalEmployees: all.length,
    avgBasic: Math.round(totalBasic / all.length),
    avgGross: Math.round(totalGross / all.length),
    totalMonthlyPayroll: totalGross,
    totalAnnualCost: totalAnnual,
    compaRatioDistribution: Object.entries(compaGroups).map(([label, count]) => ({ label, count })),
    bandDistribution: Object.entries(bandDist).map(([position, count]) => ({ position, count })),
  };
}

export async function getEquityAnalysis(db: Db, tenantId: string) {
  const compColl = db.collection('cvision_employee_compensation');
  const empColl = db.collection('cvision_employees');
  const comps = await compColl.find({ tenantId }).toArray();
  const employees = await empColl.find({ tenantId }).toArray();

  const empMap = new Map(employees.map(e => [e.employeeId, e]));

  const byDept: Record<string, { count: number; totalBasic: number; totalGross: number }> = {};
  const byGender: Record<string, { count: number; totalBasic: number }> = {};
  const byNationality: Record<string, { count: number; totalBasic: number }> = {};
  const byGrade: Record<string, { count: number; totalBasic: number; totalGross: number; employees: any[] }> = {};

  for (const c of comps) {
    const emp = empMap.get(c.employeeId);
    const dept = emp?.department || 'Unknown';
    const gender = emp?.gender || 'Unknown';
    const nat = emp?.nationality || 'Unknown';
    const grade = c.gradeId || 'Unknown';

    if (!byDept[dept]) byDept[dept] = { count: 0, totalBasic: 0, totalGross: 0 };
    byDept[dept].count++; byDept[dept].totalBasic += c.basicSalary || 0; byDept[dept].totalGross += c.grossSalary || 0;

    if (!byGender[gender]) byGender[gender] = { count: 0, totalBasic: 0 };
    byGender[gender].count++; byGender[gender].totalBasic += c.basicSalary || 0;

    if (!byNationality[nat]) byNationality[nat] = { count: 0, totalBasic: 0 };
    byNationality[nat].count++; byNationality[nat].totalBasic += c.basicSalary || 0;

    if (!byGrade[grade]) byGrade[grade] = { count: 0, totalBasic: 0, totalGross: 0, employees: [] };
    byGrade[grade].count++; byGrade[grade].totalBasic += c.basicSalary || 0; byGrade[grade].totalGross += c.grossSalary || 0;
    byGrade[grade].employees.push({ employeeId: c.employeeId, name: c.employeeName, basic: c.basicSalary, compaRatio: c.compaRatio, rangePosition: c.rangePosition });
  }

  return {
    byDepartment: Object.entries(byDept).map(([dept, d]) => ({ department: dept, count: d.count, avgBasic: Math.round(d.totalBasic / d.count), avgGross: Math.round(d.totalGross / d.count) })),
    byGender: Object.entries(byGender).map(([gender, d]) => ({ gender, count: d.count, avgBasic: Math.round(d.totalBasic / d.count) })),
    byNationality: Object.entries(byNationality).map(([nationality, d]) => ({ nationality, count: d.count, avgBasic: Math.round(d.totalBasic / d.count) })),
    byGrade: Object.entries(byGrade).map(([grade, d]) => ({ grade, count: d.count, avgBasic: Math.round(d.totalBasic / d.count), avgGross: Math.round(d.totalGross / d.count), employees: d.employees })),
  };
}

export async function simulateIncrement(db: Db, tenantId: string, percentage: number, gradeFilter?: string): Promise<{
  affectedEmployees: number; currentTotalMonthly: number; newTotalMonthly: number; monthlyIncrease: number; annualIncrease: number;
  employees: { employeeId: string; name: string; currentBasic: number; newBasic: number; increase: number }[];
}> {
  const filter: any = { tenantId };
  if (gradeFilter) filter.gradeId = gradeFilter;

  const comps = await db.collection('cvision_employee_compensation').find(filter).toArray();
  let currentTotal = 0, newTotal = 0;
  const emps = comps.map(c => {
    const increase = Math.round(c.basicSalary * percentage / 100);
    const newBasic = c.basicSalary + increase;
    currentTotal += c.basicSalary;
    newTotal += newBasic;
    return { employeeId: c.employeeId, name: c.employeeName, currentBasic: c.basicSalary, newBasic, increase };
  });

  return {
    affectedEmployees: emps.length,
    currentTotalMonthly: currentTotal,
    newTotalMonthly: newTotal,
    monthlyIncrease: newTotal - currentTotal,
    annualIncrease: (newTotal - currentTotal) * 12,
    employees: emps,
  };
}
