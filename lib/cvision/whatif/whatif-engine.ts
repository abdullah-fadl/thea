/**
 * CVision What-If Analysis Engine (Enhanced)
 *
 * Extends the existing financial what-if simulator with:
 * - Retention / flight-risk impact projections
 * - Saudization / Nitaqat band impact
 * - End-of-service (Saudi Labour Law) cost calculation
 * - Promotion wave & burnout relief scenarios
 * - Per-employee impact tracking with risk score changes
 * - Pros / cons analysis
 *
 * Pure computation — all DB fetching happens in the API layer.
 */

import { calculateGOSIContribution } from '@/lib/cvision/integrations/shared/helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WhatIfScenario {
  id: string;
  name: string;
  type: ScenarioType;
  description: string;
  parameters: Record<string, any>;
  results: WhatIfResult;
  createdAt: string;
  createdBy?: string;
}

export type ScenarioType =
  | 'SALARY_INCREASE'
  | 'NEW_HIRES'
  | 'LAYOFFS'
  | 'PROMOTION_WAVE'
  | 'BURNOUT_RELIEF'
  | 'CUSTOM';

export interface WhatIfResult {
  currentMonthlyCost: number;
  projectedMonthlyCost: number;
  monthlyCostDifference: number;
  annualCostDifference: number;
  percentageChange: number;

  currentAvgRiskScore: number;
  projectedAvgRiskScore: number;
  riskScoreChange: number;
  employeesImproved: number;

  currentHeadcount: number;
  projectedHeadcount: number;
  currentSaudizationRate: number;
  projectedSaudizationRate: number;
  nitaqatBandChange?: string;

  currentGOSIEmployer: number;
  projectedGOSIEmployer: number;
  gosiDifference: number;

  employeeImpacts: EmployeeImpact[];

  summary: string;
  pros: string[];
  cons: string[];
}

export interface EmployeeImpact {
  employeeId: string;
  employeeName: string;
  department: string;
  isSaudi: boolean;
  currentSalary: number;
  projectedSalary: number;
  salaryChange: number;
  currentRiskScore: number;
  projectedRiskScore: number;
  riskChange: number;
}

/** Employee input shape expected by the engine */
export interface WhatIfEmployee {
  id: string;
  name: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  department: string;
  departmentId: string;
  jobTitle: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  isSaudi: boolean;
  nationalId?: string;
  nationality?: string;
  hireDate?: string | null;
  riskScore: number;
  riskFactors?: Record<string, number>;
}

export interface NewHirePosition {
  title: string;
  department: string;
  salary: number;
  isSaudi: boolean;
}

export interface PromotionTarget {
  employeeId: string;
  newTitle: string;
  salaryIncrease: number;
}

export type BurnoutAction =
  | 'REDUCE_OVERTIME'
  | 'HIRE_SUPPORT'
  | 'FLEXIBLE_HOURS'
  | 'REMOTE_WORK'
  | 'TEAM_BUILDING';

export interface ScenarioComparison {
  budgetDifference: number;
  retentionDifference: number;
  better: 'SCENARIO_1' | 'SCENARIO_2' | 'EQUAL';
  analysis: string;
}

// ---------------------------------------------------------------------------
// Nitaqat band calculation (healthcare sector, 50-499 employees)
// ---------------------------------------------------------------------------

const NITAQAT_BANDS = [
  { name: 'PLATINUM', min: 40, color: '#9333ea' },
  { name: 'GREEN_HIGH', min: 27, color: '#16a34a' },
  { name: 'GREEN_MID', min: 23, color: '#22c55e' },
  { name: 'GREEN_LOW', min: 17, color: '#4ade80' },
  { name: 'YELLOW', min: 10, color: '#eab308' },
  { name: 'RED', min: 0, color: '#dc2626' },
] as const;

function getNitaqatBand(rate: number) {
  for (const band of NITAQAT_BANDS) {
    if (rate >= band.min) return band;
  }
  return NITAQAT_BANDS[NITAQAT_BANDS.length - 1];
}

function saudizationRate(saudiCount: number, total: number): number {
  if (total === 0) return 0;
  return r2((saudiCount / total) * 100);
}

// ---------------------------------------------------------------------------
// End of Service (Saudi Labour Law)
// ---------------------------------------------------------------------------

/**
 * Article 84/85 of Saudi Labour Law:
 * - Termination by employer: full entitlement
 *   First 5 years: 0.5 × monthly × years
 *   After 5 years: 1.0 × monthly × additional years
 * - Resignation by employee (2-5 years): 1/3 of above
 * - Resignation by employee (5-10 years): 2/3 of above
 * - Resignation by employee (10+ years): full
 */
export function calculateEndOfService(
  monthlySalary: number,
  yearsOfService: number,
  reason: 'RESIGNATION' | 'TERMINATION',
): number {
  if (yearsOfService < 0 || monthlySalary <= 0) return 0;

  // Full entitlement calculation
  let entitlement = 0;
  if (yearsOfService <= 5) {
    entitlement = 0.5 * monthlySalary * yearsOfService;
  } else {
    entitlement = (0.5 * monthlySalary * 5) + (1.0 * monthlySalary * (yearsOfService - 5));
  }

  if (reason === 'TERMINATION') return r2(entitlement);

  // Resignation multipliers
  if (yearsOfService < 2) return 0;
  if (yearsOfService < 5) return r2(entitlement / 3);
  if (yearsOfService < 10) return r2((entitlement * 2) / 3);
  return r2(entitlement);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function calcMonthlyPayroll(emp: WhatIfEmployee): number {
  return emp.basicSalary + emp.housingAllowance + emp.transportAllowance;
}

function calcGOSIEmployer(emp: WhatIfEmployee): number {
  const result = calculateGOSIContribution(emp.basicSalary, emp.housingAllowance, emp.isSaudi);
  return result.employerContribution;
}

function clampRisk(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function yearsOfService(hireDate: string | null | undefined): number {
  if (!hireDate) return 0;
  const hire = new Date(hireDate);
  if (isNaN(hire.getTime())) return 0;
  const diff = Date.now() - hire.getTime();
  return Math.max(0, diff / (365.25 * 24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Scenario 1: Salary Increase
// ---------------------------------------------------------------------------

export interface SalaryIncreaseParams {
  percentage: number;
  scope: 'ALL' | 'DEPARTMENT' | 'HIGH_RISK' | 'SPECIFIC';
  department?: string;
  employeeIds?: string[];
}

export function simulateSalaryIncrease(
  employees: WhatIfEmployee[],
  params: SalaryIncreaseParams,
): WhatIfResult {
  const { percentage, scope, department, employeeIds } = params;

  const impacts: EmployeeImpact[] = [];
  let projectedPayroll = 0;
  let projectedGOSI = 0;

  const currentPayroll = employees.reduce((s, e) => s + calcMonthlyPayroll(e), 0);
  const currentGOSI = employees.reduce((s, e) => s + calcGOSIEmployer(e), 0);
  const currentAvgRisk = employees.length > 0
    ? employees.reduce((s, e) => s + e.riskScore, 0) / employees.length : 0;

  let improvedCount = 0;
  let projectedRiskSum = 0;

  for (const emp of employees) {
    const affected = scope === 'ALL'
      || (scope === 'DEPARTMENT' && emp.departmentId === department)
      || (scope === 'HIGH_RISK' && emp.riskScore >= 50)
      || (scope === 'SPECIFIC' && employeeIds?.includes(emp.id));

    let projSalary = emp.basicSalary;
    let projRisk = emp.riskScore;

    if (affected) {
      projSalary = r2(emp.basicSalary * (1 + percentage / 100));

      // Retention impact: reduce salary stagnation risk
      const salaryFactor = emp.riskFactors?.salary_stagnation ?? 40;
      let reduction = 0;
      if (percentage >= 10) reduction = salaryFactor * 0.8;
      else if (percentage >= 5) reduction = salaryFactor * 0.5;
      else reduction = salaryFactor * 0.2;

      const weightedReduction = (reduction * 20) / 100;
      projRisk = clampRisk(emp.riskScore - weightedReduction);

      if (projRisk < emp.riskScore) improvedCount++;
    }

    const projHousing = affected ? r2(emp.housingAllowance * (1 + percentage / 100)) : emp.housingAllowance;
    const projTotal = projSalary + projHousing + emp.transportAllowance;
    const projEmpGOSI = calculateGOSIContribution(projSalary, projHousing, emp.isSaudi).employerContribution;

    projectedPayroll += projTotal;
    projectedGOSI += projEmpGOSI;
    projectedRiskSum += projRisk;

    impacts.push({
      employeeId: emp.id,
      employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
      department: emp.department,
      isSaudi: emp.isSaudi,
      currentSalary: emp.basicSalary,
      projectedSalary: projSalary,
      salaryChange: r2(projSalary - emp.basicSalary),
      currentRiskScore: emp.riskScore,
      projectedRiskScore: projRisk,
      riskChange: r2(projRisk - emp.riskScore),
    });
  }

  const projectedAvgRisk = employees.length > 0 ? projectedRiskSum / employees.length : 0;
  const saudiCount = employees.filter(e => e.isSaudi).length;
  const rate = saudizationRate(saudiCount, employees.length);

  const diff = r2(projectedPayroll - currentPayroll);
  const pct = currentPayroll > 0 ? r2((diff / currentPayroll) * 100) : 0;

  const pros = [
    `Reduces average flight risk by ${r2(currentAvgRisk - projectedAvgRisk)} points`,
    `${improvedCount} employees see improved retention outlook`,
  ];
  if (percentage >= 5) pros.push('Competitive market positioning for talent');

  const cons = [
    `Increases monthly payroll by SAR ${Math.round(diff).toLocaleString()}`,
    `Annual cost increase: SAR ${Math.round(diff * 12).toLocaleString()}`,
  ];
  if (pct > 15) cons.push('Exceeds 15% budget threshold — board approval required');

  return {
    currentMonthlyCost: r2(currentPayroll),
    projectedMonthlyCost: r2(projectedPayroll),
    monthlyCostDifference: diff,
    annualCostDifference: r2(diff * 12),
    percentageChange: pct,
    currentAvgRiskScore: r2(currentAvgRisk),
    projectedAvgRiskScore: r2(projectedAvgRisk),
    riskScoreChange: r2(projectedAvgRisk - currentAvgRisk),
    employeesImproved: improvedCount,
    currentHeadcount: employees.length,
    projectedHeadcount: employees.length,
    currentSaudizationRate: rate,
    projectedSaudizationRate: rate,
    currentGOSIEmployer: r2(currentGOSI),
    projectedGOSIEmployer: r2(projectedGOSI),
    gosiDifference: r2(projectedGOSI - currentGOSI),
    employeeImpacts: impacts,
    summary: `${percentage}% salary increase for ${scope === 'ALL' ? 'all employees' : scope === 'DEPARTMENT' ? `department ${department}` : scope === 'HIGH_RISK' ? 'high-risk employees' : `${employeeIds?.length || 0} selected employees`}. Monthly cost: +SAR ${Math.round(diff).toLocaleString()}, avg risk: ${r2(currentAvgRisk)} → ${r2(projectedAvgRisk)}`,
    pros,
    cons,
  };
}

// ---------------------------------------------------------------------------
// Scenario 2: New Hires
// ---------------------------------------------------------------------------

export interface NewHiresParams {
  positions: NewHirePosition[];
}

export function simulateNewHires(
  employees: WhatIfEmployee[],
  params: NewHiresParams,
): WhatIfResult {
  const { positions } = params;

  const currentPayroll = employees.reduce((s, e) => s + calcMonthlyPayroll(e), 0);
  const currentGOSI = employees.reduce((s, e) => s + calcGOSIEmployer(e), 0);
  const currentAvgRisk = employees.length > 0
    ? employees.reduce((s, e) => s + e.riskScore, 0) / employees.length : 0;
  const saudiCount = employees.filter(e => e.isSaudi).length;
  const currentRate = saudizationRate(saudiCount, employees.length);

  let additionalPayroll = 0;
  let additionalGOSI = 0;
  let newSaudis = 0;
  const impacts: EmployeeImpact[] = [];

  for (const pos of positions) {
    const housing = r2(pos.salary * 0.25);
    const transport = 500;
    const total = pos.salary + housing + transport;
    const gosi = calculateGOSIContribution(pos.salary, housing, pos.isSaudi).employerContribution;

    additionalPayroll += total;
    additionalGOSI += gosi;
    if (pos.isSaudi) newSaudis++;

    impacts.push({
      employeeId: `new_${pos.title.toLowerCase().replace(/\s/g, '_')}`,
      employeeName: `New: ${pos.title}`,
      department: pos.department,
      isSaudi: pos.isSaudi,
      currentSalary: 0,
      projectedSalary: pos.salary,
      salaryChange: pos.salary,
      currentRiskScore: 0,
      projectedRiskScore: 30,
      riskChange: 0,
    });
  }

  // Burnout relief: existing employees in same departments get workload reduction
  const deptHires = new Map<string, number>();
  for (const pos of positions) {
    deptHires.set(pos.department, (deptHires.get(pos.department) || 0) + 1);
  }

  let improvedCount = 0;
  let projectedRiskSum = 0;

  for (const emp of employees) {
    const hiresInDept = deptHires.get(emp.departmentId) || deptHires.get(emp.department) || 0;
    let projRisk = emp.riskScore;

    if (hiresInDept > 0) {
      const burnoutFactor = emp.riskFactors?.workload_burnout ?? 25;
      const reductionPct = Math.min(hiresInDept * 15, 40);
      const reduction = (burnoutFactor * reductionPct / 100) * 10 / 100;
      projRisk = clampRisk(emp.riskScore - reduction);
      if (projRisk < emp.riskScore) improvedCount++;
    }

    projectedRiskSum += projRisk;

    impacts.push({
      employeeId: emp.id,
      employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
      department: emp.department,
      isSaudi: emp.isSaudi,
      currentSalary: emp.basicSalary,
      projectedSalary: emp.basicSalary,
      salaryChange: 0,
      currentRiskScore: emp.riskScore,
      projectedRiskScore: projRisk,
      riskChange: r2(projRisk - emp.riskScore),
    });
  }

  // New hires have neutral risk
  projectedRiskSum += positions.length * 30;

  const projectedHeadcount = employees.length + positions.length;
  const projectedSaudiCount = saudiCount + newSaudis;
  const projectedRate = saudizationRate(projectedSaudiCount, projectedHeadcount);
  const projectedPayroll = r2(currentPayroll + additionalPayroll);
  const projectedGOSI = r2(currentGOSI + additionalGOSI);
  const projectedAvgRisk = projectedHeadcount > 0 ? projectedRiskSum / projectedHeadcount : 0;

  const currentBand = getNitaqatBand(currentRate);
  const projectedBand = getNitaqatBand(projectedRate);
  const bandChanged = currentBand.name !== projectedBand.name;

  const diff = r2(projectedPayroll - currentPayroll);
  const pct = currentPayroll > 0 ? r2((diff / currentPayroll) * 100) : 0;

  // Non-Saudi iqama cost
  const nonSaudiHires = positions.filter(p => !p.isSaudi).length;
  const iqamaCostAnnual = nonSaudiHires * 750;

  const pros: string[] = [];
  const cons: string[] = [];

  if (newSaudis > 0) pros.push(`Saudization rate: ${currentRate}% → ${projectedRate}%`);
  if (bandChanged && projectedRate > currentRate) pros.push(`Nitaqat band upgrade: ${currentBand.name} → ${projectedBand.name}`);
  if (improvedCount > 0) pros.push(`${improvedCount} existing employees see reduced burnout risk`);
  pros.push(`Headcount: ${employees.length} → ${projectedHeadcount}`);

  cons.push(`Monthly cost increase: SAR ${Math.round(diff).toLocaleString()}`);
  if (nonSaudiHires > 0) cons.push(`Iqama fees for ${nonSaudiHires} non-Saudi hires: SAR ${iqamaCostAnnual}/year`);
  if (bandChanged && projectedRate < currentRate) cons.push(`Nitaqat downgrade risk: ${currentBand.name} → ${projectedBand.name}`);

  return {
    currentMonthlyCost: r2(currentPayroll),
    projectedMonthlyCost: projectedPayroll,
    monthlyCostDifference: diff,
    annualCostDifference: r2(diff * 12 + iqamaCostAnnual),
    percentageChange: pct,
    currentAvgRiskScore: r2(currentAvgRisk),
    projectedAvgRiskScore: r2(projectedAvgRisk),
    riskScoreChange: r2(projectedAvgRisk - currentAvgRisk),
    employeesImproved: improvedCount,
    currentHeadcount: employees.length,
    projectedHeadcount,
    currentSaudizationRate: currentRate,
    projectedSaudizationRate: projectedRate,
    nitaqatBandChange: bandChanged ? `${currentBand.name} → ${projectedBand.name}` : undefined,
    currentGOSIEmployer: r2(currentGOSI),
    projectedGOSIEmployer: projectedGOSI,
    gosiDifference: r2(projectedGOSI - currentGOSI),
    employeeImpacts: impacts,
    summary: `Hiring ${positions.length} new employees. Cost: +SAR ${Math.round(diff).toLocaleString()}/mo. Saudization: ${currentRate}% → ${projectedRate}%.`,
    pros,
    cons,
  };
}

// ---------------------------------------------------------------------------
// Scenario 3: Layoffs / Departures
// ---------------------------------------------------------------------------

export interface LayoffsParams {
  criteria: 'LOWEST_PERFORMANCE' | 'NEWEST' | 'SPECIFIC';
  count?: number;
  department?: string;
  employeeIds?: string[];
}

export function simulateLayoffs(
  employees: WhatIfEmployee[],
  params: LayoffsParams,
): WhatIfResult {
  const { criteria, count, department, employeeIds } = params;

  let candidates = [...employees];
  if (department) candidates = candidates.filter(e => e.departmentId === department || e.department === department);

  let toRemove: WhatIfEmployee[] = [];

  if (criteria === 'SPECIFIC' && employeeIds) {
    toRemove = candidates.filter(e => employeeIds.includes(e.id));
  } else if (criteria === 'NEWEST') {
    toRemove = candidates
      .sort((a, b) => {
        const da = a.hireDate ? new Date(a.hireDate).getTime() : Date.now();
        const db = b.hireDate ? new Date(b.hireDate).getTime() : Date.now();
        return db - da;
      })
      .slice(0, count || 1);
  } else {
    toRemove = candidates
      .sort((a, b) => a.riskScore - b.riskScore)
      .slice(0, count || 1);
  }

  const removeIds = new Set(toRemove.map(e => e.id));
  const remaining = employees.filter(e => !removeIds.has(e.id));

  const currentPayroll = employees.reduce((s, e) => s + calcMonthlyPayroll(e), 0);
  const currentGOSI = employees.reduce((s, e) => s + calcGOSIEmployer(e), 0);
  const currentAvgRisk = employees.length > 0 ? employees.reduce((s, e) => s + e.riskScore, 0) / employees.length : 0;

  // End of service costs
  let totalEOS = 0;
  for (const emp of toRemove) {
    const yos = yearsOfService(emp.hireDate);
    totalEOS += calculateEndOfService(emp.basicSalary, yos, 'TERMINATION');
  }

  // Remaining employees: +15 risk points due to layoff anxiety
  const LAYOFF_ANXIETY = 15;
  let projectedRiskSum = 0;
  let improvedCount = 0;
  const impacts: EmployeeImpact[] = [];

  for (const emp of remaining) {
    const projRisk = clampRisk(emp.riskScore + LAYOFF_ANXIETY);
    projectedRiskSum += projRisk;

    impacts.push({
      employeeId: emp.id,
      employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
      department: emp.department,
      isSaudi: emp.isSaudi,
      currentSalary: emp.basicSalary,
      projectedSalary: emp.basicSalary,
      salaryChange: 0,
      currentRiskScore: emp.riskScore,
      projectedRiskScore: projRisk,
      riskChange: LAYOFF_ANXIETY,
    });
  }

  for (const emp of toRemove) {
    impacts.push({
      employeeId: emp.id,
      employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
      department: emp.department,
      isSaudi: emp.isSaudi,
      currentSalary: emp.basicSalary,
      projectedSalary: 0,
      salaryChange: -emp.basicSalary,
      currentRiskScore: emp.riskScore,
      projectedRiskScore: 0,
      riskChange: -emp.riskScore,
    });
  }

  const projectedPayroll = remaining.reduce((s, e) => s + calcMonthlyPayroll(e), 0);
  const projectedGOSI = remaining.reduce((s, e) => s + calcGOSIEmployer(e), 0);
  const projectedAvgRisk = remaining.length > 0 ? projectedRiskSum / remaining.length : 0;

  const saudiCurrent = employees.filter(e => e.isSaudi).length;
  const saudiRemaining = remaining.filter(e => e.isSaudi).length;
  const currentRate = saudizationRate(saudiCurrent, employees.length);
  const projectedRate = saudizationRate(saudiRemaining, remaining.length);

  const currentBand = getNitaqatBand(currentRate);
  const projectedBand = getNitaqatBand(projectedRate);
  const bandChanged = currentBand.name !== projectedBand.name;

  const diff = r2(projectedPayroll - currentPayroll);
  const pct = currentPayroll > 0 ? r2((diff / currentPayroll) * 100) : 0;

  const saudisLaid = toRemove.filter(e => e.isSaudi).length;

  const pros: string[] = [];
  const cons: string[] = [];

  pros.push(`Monthly savings: SAR ${Math.round(Math.abs(diff)).toLocaleString()}`);
  pros.push(`Annual savings: SAR ${Math.round(Math.abs(diff) * 12).toLocaleString()}`);

  cons.push(`End of service payout: SAR ${Math.round(totalEOS).toLocaleString()}`);
  cons.push(`Remaining employees: +${LAYOFF_ANXIETY} risk points (layoff anxiety)`);
  cons.push(`Average risk score increases: ${r2(currentAvgRisk)} → ${r2(projectedAvgRisk)}`);
  if (saudisLaid > 0) cons.push(`${saudisLaid} Saudi employee(s) affected — Saudization: ${currentRate}% → ${projectedRate}%`);
  if (bandChanged && projectedRate < currentRate) cons.push(`Nitaqat downgrade: ${currentBand.name} → ${projectedBand.name}`);

  return {
    currentMonthlyCost: r2(currentPayroll),
    projectedMonthlyCost: r2(projectedPayroll),
    monthlyCostDifference: diff,
    annualCostDifference: r2(diff * 12 + totalEOS),
    percentageChange: pct,
    currentAvgRiskScore: r2(currentAvgRisk),
    projectedAvgRiskScore: r2(projectedAvgRisk),
    riskScoreChange: r2(projectedAvgRisk - currentAvgRisk),
    employeesImproved: 0,
    currentHeadcount: employees.length,
    projectedHeadcount: remaining.length,
    currentSaudizationRate: currentRate,
    projectedSaudizationRate: projectedRate,
    nitaqatBandChange: bandChanged ? `${currentBand.name} → ${projectedBand.name}` : undefined,
    currentGOSIEmployer: r2(currentGOSI),
    projectedGOSIEmployer: r2(projectedGOSI),
    gosiDifference: r2(projectedGOSI - currentGOSI),
    employeeImpacts: impacts,
    summary: `Reducing headcount by ${toRemove.length}. Monthly savings: SAR ${Math.round(Math.abs(diff)).toLocaleString()}. EOS payout: SAR ${Math.round(totalEOS).toLocaleString()}. Risk avg rises to ${r2(projectedAvgRisk)}.`,
    pros,
    cons,
  };
}

// ---------------------------------------------------------------------------
// Scenario 4: Promotion Wave
// ---------------------------------------------------------------------------

export interface PromotionWaveParams {
  promotions: PromotionTarget[];
}

export function simulatePromotionWave(
  employees: WhatIfEmployee[],
  params: PromotionWaveParams,
): WhatIfResult {
  const { promotions } = params;

  const promMap = new Map<string, PromotionTarget>();
  for (const p of promotions) promMap.set(p.employeeId, p);

  const currentPayroll = employees.reduce((s, e) => s + calcMonthlyPayroll(e), 0);
  const currentGOSI = employees.reduce((s, e) => s + calcGOSIEmployer(e), 0);
  const currentAvgRisk = employees.length > 0 ? employees.reduce((s, e) => s + e.riskScore, 0) / employees.length : 0;

  let projectedPayroll = 0;
  let projectedGOSI = 0;
  let projectedRiskSum = 0;
  let improvedCount = 0;
  const impacts: EmployeeImpact[] = [];

  for (const emp of employees) {
    const promo = promMap.get(emp.id);
    let projSalary = emp.basicSalary;
    let projRisk = emp.riskScore;

    if (promo) {
      projSalary = r2(emp.basicSalary + promo.salaryIncrease);

      // Promotion dramatically reduces growth + salary risk
      const growthFactor = emp.riskFactors?.career_growth ?? 40;
      const salaryFactor = emp.riskFactors?.salary_stagnation ?? 40;
      const growthReduction = (growthFactor * 0.8 * 15) / 100;
      const salaryReduction = (salaryFactor * 0.5 * 20) / 100;
      projRisk = clampRisk(emp.riskScore - growthReduction - salaryReduction);
      if (projRisk < emp.riskScore) improvedCount++;
    } else {
      // Non-promoted employees get a small morale boost
      projRisk = clampRisk(emp.riskScore - 3);
      if (projRisk < emp.riskScore) improvedCount++;
    }

    const projHousing = promo ? r2(emp.housingAllowance * (1 + promo.salaryIncrease / emp.basicSalary)) : emp.housingAllowance;
    const total = projSalary + projHousing + emp.transportAllowance;
    const gosi = calculateGOSIContribution(projSalary, projHousing, emp.isSaudi).employerContribution;

    projectedPayroll += total;
    projectedGOSI += gosi;
    projectedRiskSum += projRisk;

    impacts.push({
      employeeId: emp.id,
      employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
      department: emp.department,
      isSaudi: emp.isSaudi,
      currentSalary: emp.basicSalary,
      projectedSalary: projSalary,
      salaryChange: r2(projSalary - emp.basicSalary),
      currentRiskScore: emp.riskScore,
      projectedRiskScore: projRisk,
      riskChange: r2(projRisk - emp.riskScore),
    });
  }

  const projectedAvgRisk = employees.length > 0 ? projectedRiskSum / employees.length : 0;
  const saudiCount = employees.filter(e => e.isSaudi).length;
  const rate = saudizationRate(saudiCount, employees.length);

  const diff = r2(projectedPayroll - currentPayroll);
  const pct = currentPayroll > 0 ? r2((diff / currentPayroll) * 100) : 0;

  return {
    currentMonthlyCost: r2(currentPayroll),
    projectedMonthlyCost: r2(projectedPayroll),
    monthlyCostDifference: diff,
    annualCostDifference: r2(diff * 12),
    percentageChange: pct,
    currentAvgRiskScore: r2(currentAvgRisk),
    projectedAvgRiskScore: r2(projectedAvgRisk),
    riskScoreChange: r2(projectedAvgRisk - currentAvgRisk),
    employeesImproved: improvedCount,
    currentHeadcount: employees.length,
    projectedHeadcount: employees.length,
    currentSaudizationRate: rate,
    projectedSaudizationRate: rate,
    currentGOSIEmployer: r2(currentGOSI),
    projectedGOSIEmployer: r2(projectedGOSI),
    gosiDifference: r2(projectedGOSI - currentGOSI),
    employeeImpacts: impacts,
    summary: `Promoting ${promotions.length} employees. Cost: +SAR ${Math.round(diff).toLocaleString()}/mo. Avg risk: ${r2(currentAvgRisk)} → ${r2(projectedAvgRisk)}. ${improvedCount} improved.`,
    pros: [
      `Average risk drops by ${r2(currentAvgRisk - projectedAvgRisk)} points`,
      `${improvedCount} employees see improved retention outlook`,
      'Positive organizational morale signal',
      `Dramatically reduces career growth stagnation factor`,
    ],
    cons: [
      `Monthly cost increase: SAR ${Math.round(diff).toLocaleString()}`,
      `Annual cost: SAR ${Math.round(diff * 12).toLocaleString()}`,
      promotions.length > employees.length * 0.3 ? 'Promoting >30% may set unrealistic expectations' : '',
    ].filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Scenario 5: Burnout Relief
// ---------------------------------------------------------------------------

const BURNOUT_ACTIONS: Record<BurnoutAction, {
  label: string;
  burnoutReduction: number;
  generalReduction: number;
  costPerEmployee: number;
  costLabel: string;
}> = {
  REDUCE_OVERTIME: { label: 'Reduce Overtime', burnoutReduction: 40, generalReduction: 0, costPerEmployee: 0, costLabel: 'potential productivity loss' },
  HIRE_SUPPORT: { label: 'Hire Support Staff', burnoutReduction: 30, generalReduction: 0, costPerEmployee: 5000, costLabel: 'new hire salary' },
  FLEXIBLE_HOURS: { label: 'Flexible Hours', burnoutReduction: 15, generalReduction: 0, costPerEmployee: 0, costLabel: 'minimal' },
  REMOTE_WORK: { label: 'Remote Work', burnoutReduction: 20, generalReduction: 0, costPerEmployee: 2000, costLabel: 'tech setup per employee' },
  TEAM_BUILDING: { label: 'Team Building', burnoutReduction: 0, generalReduction: 5, costPerEmployee: 500, costLabel: 'per employee per quarter' },
};

export interface BurnoutReliefParams {
  actions: BurnoutAction[];
}

export function simulateBurnoutRelief(
  employees: WhatIfEmployee[],
  params: BurnoutReliefParams,
): WhatIfResult {
  const { actions } = params;

  const currentPayroll = employees.reduce((s, e) => s + calcMonthlyPayroll(e), 0);
  const currentGOSI = employees.reduce((s, e) => s + calcGOSIEmployer(e), 0);
  const currentAvgRisk = employees.length > 0 ? employees.reduce((s, e) => s + e.riskScore, 0) / employees.length : 0;

  // Aggregate reductions from all selected actions
  let totalBurnoutReduction = 0;
  let totalGeneralReduction = 0;
  let totalCostPerEmployee = 0;
  const actionLabels: string[] = [];

  for (const a of actions) {
    const cfg = BURNOUT_ACTIONS[a];
    if (!cfg) continue;
    totalBurnoutReduction += cfg.burnoutReduction;
    totalGeneralReduction += cfg.generalReduction;
    totalCostPerEmployee += cfg.costPerEmployee;
    actionLabels.push(cfg.label);
  }

  // Cap reductions
  totalBurnoutReduction = Math.min(totalBurnoutReduction, 80);
  totalGeneralReduction = Math.min(totalGeneralReduction, 15);

  let projectedRiskSum = 0;
  let improvedCount = 0;
  const impacts: EmployeeImpact[] = [];

  for (const emp of employees) {
    const burnoutFactor = emp.riskFactors?.workload_burnout ?? 25;
    const burnoutReduction = (burnoutFactor * totalBurnoutReduction / 100) * 10 / 100;
    const generalReduction = totalGeneralReduction * (emp.riskScore / 100);
    const projRisk = clampRisk(emp.riskScore - burnoutReduction - generalReduction);

    if (projRisk < emp.riskScore) improvedCount++;
    projectedRiskSum += projRisk;

    impacts.push({
      employeeId: emp.id,
      employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
      department: emp.department,
      isSaudi: emp.isSaudi,
      currentSalary: emp.basicSalary,
      projectedSalary: emp.basicSalary,
      salaryChange: 0,
      currentRiskScore: emp.riskScore,
      projectedRiskScore: projRisk,
      riskChange: r2(projRisk - emp.riskScore),
    });
  }

  const projectedAvgRisk = employees.length > 0 ? projectedRiskSum / employees.length : 0;
  const saudiCount = employees.filter(e => e.isSaudi).length;
  const rate = saudizationRate(saudiCount, employees.length);

  const totalCost = r2(totalCostPerEmployee * employees.length);
  const monthlyCost = r2(totalCost / 12);

  return {
    currentMonthlyCost: r2(currentPayroll),
    projectedMonthlyCost: r2(currentPayroll + monthlyCost),
    monthlyCostDifference: monthlyCost,
    annualCostDifference: totalCost,
    percentageChange: currentPayroll > 0 ? r2((monthlyCost / currentPayroll) * 100) : 0,
    currentAvgRiskScore: r2(currentAvgRisk),
    projectedAvgRiskScore: r2(projectedAvgRisk),
    riskScoreChange: r2(projectedAvgRisk - currentAvgRisk),
    employeesImproved: improvedCount,
    currentHeadcount: employees.length,
    projectedHeadcount: employees.length,
    currentSaudizationRate: rate,
    projectedSaudizationRate: rate,
    currentGOSIEmployer: r2(currentGOSI),
    projectedGOSIEmployer: r2(currentGOSI),
    gosiDifference: 0,
    employeeImpacts: impacts,
    summary: `Burnout relief: ${actionLabels.join(', ')}. Cost: SAR ${Math.round(totalCost).toLocaleString()}/yr. Avg risk: ${r2(currentAvgRisk)} → ${r2(projectedAvgRisk)}. ${improvedCount} improved.`,
    pros: [
      `Average risk drops by ${r2(currentAvgRisk - projectedAvgRisk)} points`,
      `${improvedCount} employees benefit`,
      ...actions.filter(a => BURNOUT_ACTIONS[a]?.costPerEmployee === 0).map(a => `${BURNOUT_ACTIONS[a].label}: zero direct cost`),
    ],
    cons: [
      totalCost > 0 ? `Annual cost: SAR ${Math.round(totalCost).toLocaleString()}` : '',
      actions.includes('REDUCE_OVERTIME') ? 'Potential short-term productivity dip' : '',
      actions.includes('REMOTE_WORK') ? 'Requires tech infrastructure investment' : '',
    ].filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Compare two scenarios
// ---------------------------------------------------------------------------

export function compareScenarios(
  scenario1: WhatIfResult,
  scenario2: WhatIfResult,
): ScenarioComparison {
  const budgetDiff = r2(scenario1.annualCostDifference - scenario2.annualCostDifference);
  const retentionDiff = r2(scenario1.riskScoreChange - scenario2.riskScoreChange);

  // Lower cost + lower risk = better
  const s1Score = (scenario1.annualCostDifference / 10000) + scenario1.riskScoreChange;
  const s2Score = (scenario2.annualCostDifference / 10000) + scenario2.riskScoreChange;

  const better: ScenarioComparison['better'] =
    Math.abs(s1Score - s2Score) < 0.5 ? 'EQUAL' : s1Score < s2Score ? 'SCENARIO_1' : 'SCENARIO_2';

  const analysis = `Budget difference: SAR ${Math.round(Math.abs(budgetDiff)).toLocaleString()}/yr. Retention impact difference: ${Math.abs(retentionDiff).toFixed(1)} risk points. ` +
    (better === 'EQUAL' ? 'Both scenarios are roughly equivalent.'
      : `Scenario ${better === 'SCENARIO_1' ? '1' : '2'} offers a better overall cost-to-retention ratio.`);

  return { budgetDifference: budgetDiff, retentionDifference: retentionDiff, better, analysis };
}
