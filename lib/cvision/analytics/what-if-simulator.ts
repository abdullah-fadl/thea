// ─── What-If Simulator ──────────────────────────────────────────────────────
// Financial scenario modeling for salary changes, headcount planning, allowance
// adjustments, overtime changes, and budget impact analysis. HR managers simulate
// "what if" scenarios to see financial impact before making real changes.
// Pure computation — no AI API calls, no DB, no side effects.

// ─── Types & Interfaces ────────────────────────────────────────────────────

export type ScenarioType =
  | 'SALARY_ADJUSTMENT'
  | 'HEADCOUNT_CHANGE'
  | 'ALLOWANCE_CHANGE'
  | 'OVERTIME_CHANGE'
  | 'BONUS'
  | 'DEPARTMENT_RESTRUCTURE'
  | 'CUSTOM';

export interface SimulationScenario {
  id: string;
  name: string;
  type: ScenarioType;
  description: string;
  createdAt: Date;
  createdBy?: string;
}

export interface SalaryAdjustmentParams {
  scope: 'ALL' | 'DEPARTMENT' | 'GRADE' | 'INDIVIDUAL';
  department?: string;
  grade?: string;
  employeeIds?: string[];
  adjustmentType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  adjustmentValue: number;
  effectiveDate: Date;
  includeAllowances: boolean;
}

export interface HeadcountChangeParams {
  department: string;
  action: 'HIRE' | 'TERMINATE' | 'TRANSFER';
  count: number;
  averageSalary?: number;
  averageAllowances?: number;
  transferToDepartment?: string;
  effectiveDate: Date;
}

export interface AllowanceChangeParams {
  allowanceType: 'HOUSING' | 'TRANSPORT' | 'FOOD' | 'ALL' | string;
  scope: 'ALL' | 'DEPARTMENT' | 'GRADE';
  department?: string;
  grade?: string;
  adjustmentType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'SET_VALUE';
  adjustmentValue: number;
  effectiveDate: Date;
}

export interface OvertimeChangeParams {
  scope: 'ALL' | 'DEPARTMENT';
  department?: string;
  changeType: 'REDUCE_BY_PERCENTAGE' | 'SET_MAX_HOURS' | 'ELIMINATE';
  value?: number;
  effectiveDate: Date;
}

export interface CurrentStateEmployee {
  id: string;
  name: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  department: string;
  grade: string;
  basicSalary: number;
  allowances: { type: string; amount: number }[];
  totalPackage: number;
  gosiEmployee: number;
  gosiEmployer: number;
}

export interface DepartmentSummary {
  department: string;
  headcount: number;
  totalCost: number;
  averageSalary: number;
}

export interface CurrentState {
  employees: CurrentStateEmployee[];
  departmentSummary: DepartmentSummary[];
  monthlyPayrollTotal: number;
  annualPayrollTotal: number;
  totalGosiEmployer: number;
  totalGosiEmployee: number;
}

export interface SimulationResult {
  scenarioId: string;
  scenarioName: string;
  currentState: {
    monthlyTotal: number;
    annualTotal: number;
    headcount: number;
    averageSalary: number;
    gosiEmployerMonthly: number;
  };
  projectedState: {
    monthlyTotal: number;
    annualTotal: number;
    headcount: number;
    averageSalary: number;
    gosiEmployerMonthly: number;
  };
  impact: {
    monthlyDifference: number;
    annualDifference: number;
    percentageChange: number;
    headcountChange: number;
    averageSalaryChange: number;
    gosiImpactMonthly: number;
  };
  departmentImpact: {
    department: string;
    currentMonthly: number;
    projectedMonthly: number;
    difference: number;
    percentageChange: number;
    headcountChange: number;
  }[];
  affectedEmployees: number;
  totalEmployees: number;
  warnings: string[];
  summary: string;
  generatedAt: Date;
}

export interface MultiScenarioComparison {
  scenarios: {
    scenarioId: string;
    name: string;
    annualCost: number;
    monthlyCost: number;
    headcount: number;
    costChangePercent: number;
  }[];
  cheapestScenario: string;
  mostExpensiveScenario: string;
  recommendation: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

/**
 * GOSI contribution rates — re-exported from the canonical source in gosi.ts.
 * Employee: pension 9% + SANED 0.75% = 9.75%
 * Employer: pension 9% + SANED 0.75% + occupational hazards 2% = 11.75%
 * maxContributionBase: 45,000 SAR monthly cap
 */
import { GOSI_RATES as _CANONICAL_GOSI } from '../gosi';

export const GOSI_RATES = {
  employerRate: _CANONICAL_GOSI.EMPLOYER_RATE,
  employeeRate: _CANONICAL_GOSI.EMPLOYEE_RATE,
  maxContributionBase: _CANONICAL_GOSI.MAX_SALARY,
} as const;

// ─── Internal Helpers ──────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return round2(((current - previous) / previous) * 100);
}

function formatSAR(amount: number): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

function calcGosiEmployer(basicSalary: number, housingAllowance: number): number {
  const insurable = Math.min(basicSalary + housingAllowance, GOSI_RATES.maxContributionBase);
  return round2(insurable * GOSI_RATES.employerRate);
}

function calcGosiEmployee(basicSalary: number, housingAllowance: number): number {
  const insurable = Math.min(basicSalary + housingAllowance, GOSI_RATES.maxContributionBase);
  return round2(insurable * GOSI_RATES.employeeRate);
}

function getHousingAllowance(allowances: { type: string; amount: number }[]): number {
  const housing = allowances.find(a =>
    a.type?.toUpperCase() === 'HOUSING' ||
    a.type?.toUpperCase() === 'HOUSING_ALLOWANCE'
  );
  return housing?.amount || 0;
}

function sumAllowances(allowances: { type: string; amount: number }[]): number {
  return allowances.reduce((sum, a) => sum + (a.amount || 0), 0);
}

function buildDeptMap(employees: CurrentStateEmployee[]): Record<string, CurrentStateEmployee[]> {
  const map: Record<string, CurrentStateEmployee[]> = {};
  for (const emp of employees) {
    if (!map[emp.department]) map[emp.department] = [];
    map[emp.department].push(emp);
  }
  return map;
}

function buildDeptSummary(employees: CurrentStateEmployee[]): DepartmentSummary[] {
  const deptMap = buildDeptMap(employees);
  return Object.entries(deptMap).map(([dept, emps]) => {
    const totalCost = emps.reduce((s, e) => s + e.totalPackage, 0);
    return {
      department: dept,
      headcount: emps.length,
      totalCost: round2(totalCost),
      averageSalary: emps.length > 0 ? round2(totalCost / emps.length) : 0,
    };
  });
}

function computeCurrentSnapshot(state: CurrentState) {
  const headcount = state.employees.length;
  const monthlyTotal = state.monthlyPayrollTotal;
  return {
    monthlyTotal,
    annualTotal: round2(monthlyTotal * 12),
    headcount,
    averageSalary: headcount > 0 ? round2(monthlyTotal / headcount) : 0,
    gosiEmployerMonthly: state.totalGosiEmployer,
  };
}

function computeProjectedSnapshot(employees: CurrentStateEmployee[]) {
  const headcount = employees.length;
  const monthlyTotal = round2(employees.reduce((s, e) => s + e.totalPackage, 0));
  const gosiEmployer = round2(employees.reduce((s, e) => s + e.gosiEmployer, 0));
  return {
    monthlyTotal,
    annualTotal: round2(monthlyTotal * 12),
    headcount,
    averageSalary: headcount > 0 ? round2(monthlyTotal / headcount) : 0,
    gosiEmployerMonthly: gosiEmployer,
  };
}

function buildDepartmentImpact(
  currentEmployees: CurrentStateEmployee[],
  projectedEmployees: CurrentStateEmployee[],
): SimulationResult['departmentImpact'] {
  // Collect all departments
  const depts = new Set<string>();
  currentEmployees.forEach(e => depts.add(e.department));
  projectedEmployees.forEach(e => depts.add(e.department));

  return Array.from(depts).map(dept => {
    const curEmps = currentEmployees.filter(e => e.department === dept);
    const projEmps = projectedEmployees.filter(e => e.department === dept);
    const currentMonthly = round2(curEmps.reduce((s, e) => s + e.totalPackage, 0));
    const projectedMonthly = round2(projEmps.reduce((s, e) => s + e.totalPackage, 0));
    const difference = round2(projectedMonthly - currentMonthly);
    return {
      department: dept,
      currentMonthly,
      projectedMonthly,
      difference,
      percentageChange: pctChange(projectedMonthly, currentMonthly),
      headcountChange: projEmps.length - curEmps.length,
    };
  });
}

function isAffected(
  emp: CurrentStateEmployee,
  scope: string,
  department?: string,
  grade?: string,
  employeeIds?: string[],
): boolean {
  switch (scope) {
    case 'ALL':
      return true;
    case 'DEPARTMENT':
      return department ? emp.department === department : false;
    case 'GRADE':
      return grade ? emp.grade === grade : false;
    case 'INDIVIDUAL':
      return employeeIds ? employeeIds.includes(emp.id) : false;
    default:
      return false;
  }
}

// ─── Exported Functions ────────────────────────────────────────────────────

/**
 * Process raw employee data into a structured CurrentState for simulation.
 * Calculates per-employee total package, GOSI contributions, department
 * summaries, and organization-wide monthly/annual totals.
 */
export function buildCurrentState(employees: {
  id: string;
  name: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  department: string;
  grade: string;
  basicSalary: number;
  allowances?: { type: string; amount: number }[];
  nationality?: string;
}[]): CurrentState {
  const processed: CurrentStateEmployee[] = employees.map(emp => {
    const allowances = emp.allowances || [];
    const totalAllowances = sumAllowances(allowances);
    const totalPackage = round2(emp.basicSalary + totalAllowances);
    const housingAllowance = getHousingAllowance(allowances);

    // GOSI: based on basic salary + housing allowance, capped at 45,000
    const gosiEmployer = calcGosiEmployer(emp.basicSalary, housingAllowance);
    // Employee GOSI applies to Saudi nationals; for simulation we calculate for all
    // (the API route layer can filter by nationality when presenting results)
    const gosiEmployee = calcGosiEmployee(emp.basicSalary, housingAllowance);

    return {
      id: emp.id,
      name: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
      department: emp.department,
      grade: emp.grade,
      basicSalary: emp.basicSalary,
      allowances,
      totalPackage,
      gosiEmployee,
      gosiEmployer,
    };
  });

  const departmentSummary = buildDeptSummary(processed);
  const monthlyPayrollTotal = round2(processed.reduce((s, e) => s + e.totalPackage, 0));
  const totalGosiEmployer = round2(processed.reduce((s, e) => s + e.gosiEmployer, 0));
  const totalGosiEmployee = round2(processed.reduce((s, e) => s + e.gosiEmployee, 0));

  return {
    employees: processed,
    departmentSummary,
    monthlyPayrollTotal,
    annualPayrollTotal: round2(monthlyPayrollTotal * 12),
    totalGosiEmployer,
    totalGosiEmployee,
  };
}

/**
 * Simulate salary adjustments (percentage or fixed amount) for a scoped
 * set of employees. Optionally adjusts allowances proportionally.
 * Recalculates GOSI, produces department impact breakdown, and generates
 * warnings and summaries.
 */
export function simulateSalaryAdjustment(
  currentState: CurrentState,
  params: SalaryAdjustmentParams,
): SimulationResult {
  const scenarioId = generateId('sim_sal');
  const warnings: string[] = [];

  // Deep clone employees for projection
  const projected: CurrentStateEmployee[] = currentState.employees.map(emp => ({
    ...emp,
    allowances: emp.allowances.map(a => ({ ...a })),
  }));

  let affectedCount = 0;

  for (const emp of projected) {
    const affected = isAffected(
      emp, params.scope, params.department, params.grade, params.employeeIds,
    );
    if (!affected) continue;
    affectedCount++;

    // Adjust basic salary
    const oldSalary = emp.basicSalary;
    if (params.adjustmentType === 'PERCENTAGE') {
      emp.basicSalary = round2(oldSalary * (1 + params.adjustmentValue / 100));
    } else {
      emp.basicSalary = round2(oldSalary + params.adjustmentValue);
    }

    // Optionally adjust allowances proportionally
    if (params.includeAllowances && params.adjustmentType === 'PERCENTAGE') {
      for (const allowance of emp.allowances) {
        allowance.amount = round2(allowance.amount * (1 + params.adjustmentValue / 100));
      }
    }

    // Recalculate total package
    emp.totalPackage = round2(emp.basicSalary + sumAllowances(emp.allowances));

    // Recalculate GOSI
    const housingAllowance = getHousingAllowance(emp.allowances);
    emp.gosiEmployer = calcGosiEmployer(emp.basicSalary, housingAllowance);
    emp.gosiEmployee = calcGosiEmployee(emp.basicSalary, housingAllowance);

    // Warning: salary exceeds GOSI cap
    if (emp.basicSalary + housingAllowance > GOSI_RATES.maxContributionBase) {
      warnings.push(`Employee ${emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee'} salary exceeds GOSI contribution cap of 45,000 SAR`);
    }
  }

  // Build snapshots
  const current = computeCurrentSnapshot(currentState);
  const projSnap = computeProjectedSnapshot(projected);

  const totalPctChange = pctChange(projSnap.monthlyTotal, current.monthlyTotal);

  // Warning: total increase > 15%
  if (totalPctChange > 15) {
    warnings.push('Total payroll increase exceeds 15% — requires board approval');
  }

  // Department-level warnings
  const deptImpact = buildDepartmentImpact(currentState.employees, projected);
  for (const di of deptImpact) {
    if (di.percentageChange > 20) {
      warnings.push(`${di.department} cost increase is significant at ${di.percentageChange}%`);
    }
  }

  // Summary
  const scopeLabel = params.scope === 'ALL' ? 'all employees'
    : params.scope === 'DEPARTMENT' ? `department ${params.department}`
    : params.scope === 'GRADE' ? `grade ${params.grade}`
    : `${affectedCount} selected employees`;

  const adjLabel = params.adjustmentType === 'PERCENTAGE'
    ? `${params.adjustmentValue}%`
    : `${formatSAR(params.adjustmentValue)}`;

  const diff = round2(projSnap.monthlyTotal - current.monthlyTotal);

  const summary = `Adjusting salaries by ${adjLabel} for ${scopeLabel} affects ${affectedCount} employees. ` +
    `Monthly cost impact: ${diff >= 0 ? '+' : ''}${formatSAR(diff)} (${totalPctChange >= 0 ? '+' : ''}${totalPctChange}% change).` +
    (params.includeAllowances ? ' Allowances adjusted proportionally.' : '');

  return {
    scenarioId,
    scenarioName: `Salary Adjustment: ${adjLabel} for ${scopeLabel}`,
    currentState: current,
    projectedState: projSnap,
    impact: {
      monthlyDifference: diff,
      annualDifference: round2(diff * 12),
      percentageChange: totalPctChange,
      headcountChange: 0,
      averageSalaryChange: round2(projSnap.averageSalary - current.averageSalary),
      gosiImpactMonthly: round2(projSnap.gosiEmployerMonthly - current.gosiEmployerMonthly),
    },
    departmentImpact: deptImpact,
    affectedEmployees: affectedCount,
    totalEmployees: currentState.employees.length,
    warnings,
    summary,
    generatedAt: new Date(),
  };
}

/**
 * Simulate headcount changes: HIRE new employees, TERMINATE existing ones,
 * or TRANSFER between departments. Uses department averages when individual
 * salary data isn't provided. Generates understaffing and growth warnings.
 */
export function simulateHeadcountChange(
  currentState: CurrentState,
  params: HeadcountChangeParams,
): SimulationResult {
  const scenarioId = generateId('sim_hc');
  const warnings: string[] = [];

  // Deep clone employees
  let projected: CurrentStateEmployee[] = currentState.employees.map(emp => ({
    ...emp,
    allowances: emp.allowances.map(a => ({ ...a })),
  }));

  let affectedCount = 0;
  const { department, action, count } = params;

  // Compute department average for salary estimation
  const deptEmployees = projected.filter(e => e.department === department);
  const deptAvgSalary = deptEmployees.length > 0
    ? round2(deptEmployees.reduce((s, e) => s + e.basicSalary, 0) / deptEmployees.length)
    : 5000; // fallback
  const deptAvgAllowances = deptEmployees.length > 0
    ? round2(deptEmployees.reduce((s, e) => s + sumAllowances(e.allowances), 0) / deptEmployees.length)
    : 1500; // fallback

  // Compute department average allowance breakdown ratios
  const deptAvgAllowanceBreakdown: { type: string; amount: number }[] = [];
  if (deptEmployees.length > 0) {
    const typeMap: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    for (const emp of deptEmployees) {
      for (const a of emp.allowances) {
        typeMap[a.type] = (typeMap[a.type] || 0) + a.amount;
        typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
      }
    }
    for (const [type, total] of Object.entries(typeMap)) {
      deptAvgAllowanceBreakdown.push({
        type,
        amount: round2(total / (typeCounts[type] || 1)),
      });
    }
  } else {
    deptAvgAllowanceBreakdown.push({ type: 'HOUSING', amount: 1000 });
    deptAvgAllowanceBreakdown.push({ type: 'TRANSPORT', amount: 500 });
  }

  if (action === 'HIRE') {
    const salary = params.averageSalary ?? deptAvgSalary;
    const allowTotal = params.averageAllowances ?? deptAvgAllowances;

    // Scale allowance breakdown proportionally if user provided a custom total
    const breakdownScale = deptAvgAllowances > 0
      ? allowTotal / deptAvgAllowances
      : 1;

    for (let i = 0; i < count; i++) {
      const newAllowances = deptAvgAllowanceBreakdown.map(a => ({
        type: a.type,
        amount: round2(a.amount * breakdownScale),
      }));
      const housingAllow = getHousingAllowance(newAllowances);

      const newEmp: CurrentStateEmployee = {
        id: `sim_new_${department}_${i}`,
        name: `New Hire ${i + 1} (${department})`,
        department,
        grade: 'TBD',
        basicSalary: salary,
        allowances: newAllowances,
        totalPackage: round2(salary + sumAllowances(newAllowances)),
        gosiEmployer: calcGosiEmployer(salary, housingAllow),
        gosiEmployee: calcGosiEmployee(salary, housingAllow),
      };
      projected.push(newEmp);
      affectedCount++;
    }

    // Growth warning
    const newDeptCount = deptEmployees.length + count;
    const growthPct = deptEmployees.length > 0
      ? pctChange(newDeptCount, deptEmployees.length)
      : 100;

    if (growthPct > 30) {
      warnings.push(`Significant growth in ${department} — consider management capacity`);
    }

  } else if (action === 'TERMINATE') {
    // Default: remove employees at department average cost (middle scenario)
    // Sort by totalPackage ascending to remove from the middle
    const sorted = [...deptEmployees].sort((a, b) => a.totalPackage - b.totalPackage);
    const removeCount = Math.min(count, sorted.length);

    // Remove from the middle (average-cost employees)
    const startIdx = Math.floor((sorted.length - removeCount) / 2);
    const toRemove = new Set(sorted.slice(startIdx, startIdx + removeCount).map(e => e.id));

    projected = projected.filter(e => !toRemove.has(e.id));
    affectedCount = removeCount;

    // Understaffing warning
    const remainingCount = deptEmployees.length - removeCount;
    if (remainingCount < 3) {
      warnings.push(`Warning: ${department} will have critical understaffing (${remainingCount} remaining)`);
    }

  } else if (action === 'TRANSFER') {
    const targetDept = params.transferToDepartment;
    if (!targetDept) {
      warnings.push('Transfer destination department not specified');
    } else {
      // Transfer employees (sorted by seniority approximation — lowest totalPackage first)
      const sorted = [...deptEmployees].sort((a, b) => a.totalPackage - b.totalPackage);
      const transferCount = Math.min(count, sorted.length);

      for (let i = 0; i < transferCount; i++) {
        const emp = projected.find(e => e.id === sorted[i].id);
        if (emp) {
          emp.department = targetDept;
          affectedCount++;
        }
      }

      // Understaffing warning for source
      const remaining = deptEmployees.length - transferCount;
      if (remaining < 3) {
        warnings.push(`Warning: ${department} will have critical understaffing after transfer (${remaining} remaining)`);
      }
    }
  }

  // Build snapshots
  const current = computeCurrentSnapshot(currentState);
  const projSnap = computeProjectedSnapshot(projected);
  const deptImpact = buildDepartmentImpact(currentState.employees, projected);
  const diff = round2(projSnap.monthlyTotal - current.monthlyTotal);
  const totalPctChange = pctChange(projSnap.monthlyTotal, current.monthlyTotal);

  // Summary
  const actionLabel = action === 'HIRE' ? 'Hiring' : action === 'TERMINATE' ? 'Terminating' : 'Transferring';

  const summary = `${actionLabel} ${count} employee${count > 1 ? 's' : ''} in ${department}` +
    (action === 'TRANSFER' ? ` to ${params.transferToDepartment}` : '') +
    `. Monthly cost impact: ${diff >= 0 ? '+' : ''}${formatSAR(diff)} (${totalPctChange >= 0 ? '+' : ''}${totalPctChange}% change). ` +
    `Headcount: ${current.headcount} → ${projSnap.headcount}.`;

  return {
    scenarioId,
    scenarioName: `Headcount: ${actionLabel} ${count} in ${department}`,
    currentState: current,
    projectedState: projSnap,
    impact: {
      monthlyDifference: diff,
      annualDifference: round2(diff * 12),
      percentageChange: totalPctChange,
      headcountChange: projSnap.headcount - current.headcount,
      averageSalaryChange: round2(projSnap.averageSalary - current.averageSalary),
      gosiImpactMonthly: round2(projSnap.gosiEmployerMonthly - current.gosiEmployerMonthly),
    },
    departmentImpact: deptImpact,
    affectedEmployees: affectedCount,
    totalEmployees: currentState.employees.length,
    warnings,
    summary,
    generatedAt: new Date(),
  };
}

/**
 * Simulate allowance changes (housing, transport, food, or all) for a
 * scoped set of employees. Supports percentage increase, fixed amount
 * adjustment, or setting an absolute value. Note: allowances typically
 * don't affect GOSI base in Saudi Arabia except housing.
 */
export function simulateAllowanceChange(
  currentState: CurrentState,
  params: AllowanceChangeParams,
): SimulationResult {
  const scenarioId = generateId('sim_alw');
  const warnings: string[] = [];

  // Deep clone
  const projected: CurrentStateEmployee[] = currentState.employees.map(emp => ({
    ...emp,
    allowances: emp.allowances.map(a => ({ ...a })),
  }));

  let affectedCount = 0;
  const targetType = params.allowanceType.toUpperCase();

  for (const emp of projected) {
    const inScope = isAffected(emp, params.scope, params.department, params.grade);
    if (!inScope) continue;

    let wasModified = false;

    for (const allowance of emp.allowances) {
      const matchesType = targetType === 'ALL' || allowance.type.toUpperCase() === targetType;
      if (!matchesType) continue;

      const oldAmount = allowance.amount;

      if (params.adjustmentType === 'PERCENTAGE') {
        allowance.amount = round2(oldAmount * (1 + params.adjustmentValue / 100));
      } else if (params.adjustmentType === 'FIXED_AMOUNT') {
        allowance.amount = round2(oldAmount + params.adjustmentValue);
      } else if (params.adjustmentType === 'SET_VALUE') {
        allowance.amount = round2(params.adjustmentValue);
      }

      // Ensure non-negative
      if (allowance.amount < 0) allowance.amount = 0;
      wasModified = true;
    }

    if (wasModified) {
      affectedCount++;

      // Recalculate total package
      emp.totalPackage = round2(emp.basicSalary + sumAllowances(emp.allowances));

      // Recalculate GOSI (housing affects GOSI base)
      const housingAllowance = getHousingAllowance(emp.allowances);
      emp.gosiEmployer = calcGosiEmployer(emp.basicSalary, housingAllowance);
      emp.gosiEmployee = calcGosiEmployee(emp.basicSalary, housingAllowance);
    }
  }

  // Build snapshots
  const current = computeCurrentSnapshot(currentState);
  const projSnap = computeProjectedSnapshot(projected);
  const deptImpact = buildDepartmentImpact(currentState.employees, projected);
  const diff = round2(projSnap.monthlyTotal - current.monthlyTotal);
  const totalPctChange = pctChange(projSnap.monthlyTotal, current.monthlyTotal);

  // Warning: housing changes affect GOSI
  if (targetType === 'HOUSING' || targetType === 'ALL') {
    warnings.push('Note: Housing allowance changes affect GOSI contribution base');
  }

  if (Math.abs(totalPctChange) > 10) {
    warnings.push(`Allowance change results in ${Math.abs(totalPctChange)}% overall payroll impact`);
  }

  // Summary
  const typeLabel = targetType === 'ALL' ? 'all allowances' : `${params.allowanceType} allowance`;

  const scopeLabel = params.scope === 'ALL' ? 'all employees'
    : params.scope === 'DEPARTMENT' ? `department ${params.department}`
    : `grade ${params.grade}`;

  const adjLabel = params.adjustmentType === 'PERCENTAGE' ? `${params.adjustmentValue}%`
    : params.adjustmentType === 'FIXED_AMOUNT' ? `${formatSAR(params.adjustmentValue)}`
    : `set to ${formatSAR(params.adjustmentValue)}`;

  const summary = `Adjusting ${typeLabel} by ${adjLabel} for ${scopeLabel} affects ${affectedCount} employees. ` +
    `Monthly cost impact: ${diff >= 0 ? '+' : ''}${formatSAR(diff)} (${totalPctChange >= 0 ? '+' : ''}${totalPctChange}% change).`;

  return {
    scenarioId,
    scenarioName: `Allowance Change: ${typeLabel} ${adjLabel}`,
    currentState: current,
    projectedState: projSnap,
    impact: {
      monthlyDifference: diff,
      annualDifference: round2(diff * 12),
      percentageChange: totalPctChange,
      headcountChange: 0,
      averageSalaryChange: round2(projSnap.averageSalary - current.averageSalary),
      gosiImpactMonthly: round2(projSnap.gosiEmployerMonthly - current.gosiEmployerMonthly),
    },
    departmentImpact: deptImpact,
    affectedEmployees: affectedCount,
    totalEmployees: currentState.employees.length,
    warnings,
    summary,
    generatedAt: new Date(),
  };
}

/**
 * Simulate overtime cost changes: reduce by percentage, set maximum hours,
 * or eliminate entirely. Works with existing overtime cost data per
 * department to project savings.
 */
export function simulateOvertimeChange(
  currentState: CurrentState,
  params: OvertimeChangeParams,
  currentOvertimeCosts: { department: string; monthlyCost: number }[],
): SimulationResult {
  const scenarioId = generateId('sim_ot');
  const warnings: string[] = [];

  // Calculate current overtime total
  const filteredOT = params.scope === 'DEPARTMENT' && params.department
    ? currentOvertimeCosts.filter(ot => ot.department === params.department)
    : currentOvertimeCosts;

  const currentOTTotal = round2(filteredOT.reduce((s, ot) => s + ot.monthlyCost, 0));
  let projectedOTTotal = 0;

  // Department-level OT projections
  const otByDept: Record<string, { current: number; projected: number }> = {};
  for (const ot of currentOvertimeCosts) {
    const isInScope = params.scope === 'ALL' ||
      (params.scope === 'DEPARTMENT' && ot.department === params.department);

    const current = ot.monthlyCost;
    let projected = current;

    if (isInScope) {
      switch (params.changeType) {
        case 'REDUCE_BY_PERCENTAGE': {
          const reduction = (params.value || 0) / 100;
          projected = round2(current * (1 - reduction));
          break;
        }
        case 'SET_MAX_HOURS': {
          // Estimate: assume average hourly OT rate across the department
          // If current cost is known, we approximate by capping proportionally
          // This is a simplification — real-world would need per-employee hour data
          const maxHours = params.value || 0;
          // Rough estimate: assume 20 hours average current OT per employee
          const deptEmps = currentState.employees.filter(e => e.department === ot.department);
          const estimatedCurrentHours = deptEmps.length * 20; // default assumption
          if (estimatedCurrentHours > 0 && maxHours * deptEmps.length < estimatedCurrentHours) {
            const ratio = (maxHours * deptEmps.length) / estimatedCurrentHours;
            projected = round2(current * Math.min(1, ratio));
          }
          break;
        }
        case 'ELIMINATE':
          projected = 0;
          break;
      }
    }

    otByDept[ot.department] = {
      current,
      projected,
    };
    projectedOTTotal += projected;
  }

  projectedOTTotal = round2(projectedOTTotal);
  const otSavings = round2(currentOTTotal - projectedOTTotal);

  // Build snapshots — overtime is ADDITIONAL cost on top of payroll
  const current = computeCurrentSnapshot(currentState);
  const currentWithOT = {
    ...current,
    monthlyTotal: round2(current.monthlyTotal + currentOTTotal),
    annualTotal: round2((current.monthlyTotal + currentOTTotal) * 12),
  };

  const projectedMonthlyTotal = round2(current.monthlyTotal + projectedOTTotal);
  const projSnap = {
    monthlyTotal: projectedMonthlyTotal,
    annualTotal: round2(projectedMonthlyTotal * 12),
    headcount: current.headcount,
    averageSalary: current.averageSalary,
    gosiEmployerMonthly: current.gosiEmployerMonthly, // OT doesn't affect GOSI base
  };

  const diff = round2(projSnap.monthlyTotal - currentWithOT.monthlyTotal);
  const totalPctChange = pctChange(projSnap.monthlyTotal, currentWithOT.monthlyTotal);

  // Department impact (OT changes only)
  const deptImpact: SimulationResult['departmentImpact'] = Object.entries(otByDept).map(([dept, data]) => ({
    department: dept,
    currentMonthly: data.current,
    projectedMonthly: data.projected,
    difference: round2(data.projected - data.current),
    percentageChange: pctChange(data.projected, data.current),
    headcountChange: 0,
  }));

  // Warnings
  if (params.changeType === 'ELIMINATE') {
    warnings.push('Eliminating overtime may impact employee morale and operational capacity');
  }

  if (params.changeType === 'REDUCE_BY_PERCENTAGE' && (params.value || 0) > 50) {
    warnings.push(`Reducing overtime by ${params.value}% is significant — assess operational impact`);
  }

  const scopeLabel = params.scope === 'ALL' ? 'all departments'
    : `department ${params.department}`;

  const changeLabel = params.changeType === 'REDUCE_BY_PERCENTAGE' ? `reducing overtime by ${params.value}%`
    : params.changeType === 'SET_MAX_HOURS' ? `capping overtime at ${params.value} hours`
    : 'eliminating overtime';

  const summary = `Scenario: ${changeLabel} for ${scopeLabel}. ` +
    `Monthly savings: ${formatSAR(otSavings)} (${Math.abs(totalPctChange)}% reduction). ` +
    `Current OT cost: ${formatSAR(currentOTTotal)} → Projected: ${formatSAR(projectedOTTotal)}.`;

  return {
    scenarioId,
    scenarioName: `Overtime: ${changeLabel}`,
    currentState: currentWithOT,
    projectedState: projSnap,
    impact: {
      monthlyDifference: diff,
      annualDifference: round2(diff * 12),
      percentageChange: totalPctChange,
      headcountChange: 0,
      averageSalaryChange: 0,
      gosiImpactMonthly: 0, // OT doesn't affect GOSI
    },
    departmentImpact: deptImpact,
    affectedEmployees: params.scope === 'ALL'
      ? currentState.employees.length
      : currentState.employees.filter(e => e.department === params.department).length,
    totalEmployees: currentState.employees.length,
    warnings,
    summary,
    generatedAt: new Date(),
  };
}

/**
 * Compare multiple simulation results side by side.
 * Ranks scenarios by annual cost, identifies cheapest and most expensive,
 * and generates a recommendation considering cost, headcount,
 * and average salary balance.
 */
export function compareScenarios(results: SimulationResult[]): MultiScenarioComparison {
  if (results.length === 0) {
    return {
      scenarios: [],
      cheapestScenario: '',
      mostExpensiveScenario: '',
      recommendation: 'No scenarios to compare.',
    };
  }

  const scenarios = results.map(r => ({
    scenarioId: r.scenarioId,
    name: r.scenarioName,
    annualCost: r.projectedState.annualTotal,
    monthlyCost: r.projectedState.monthlyTotal,
    headcount: r.projectedState.headcount,
    costChangePercent: r.impact.percentageChange,
  }));

  // Sort by annual cost ascending
  const sorted = [...scenarios].sort((a, b) => a.annualCost - b.annualCost);
  const cheapest = sorted[0];
  const mostExpensive = sorted[sorted.length - 1];

  // Generate recommendation
  let recommendation: string;

  if (results.length === 1) {
    const r = results[0];
    if (r.impact.percentageChange > 0) {
      recommendation = `Single scenario analyzed: "${r.scenarioName}" increases annual cost by ${formatSAR(r.impact.annualDifference)} (${r.impact.percentageChange}%). ` +
        `Ensure budget allocation before proceeding.`;
    } else {
      recommendation = `Single scenario analyzed: "${r.scenarioName}" reduces annual cost by ${formatSAR(Math.abs(r.impact.annualDifference))} (${Math.abs(r.impact.percentageChange)}%). ` +
        `Verify operational impact before implementing.`;
    }
  } else {
    const savingsDiff = round2(mostExpensive.annualCost - cheapest.annualCost);

    recommendation = `Comparing ${results.length} scenarios: "${cheapest.name}" is the most cost-effective at ${formatSAR(cheapest.annualCost)}/year, ` +
      `while "${mostExpensive.name}" costs ${formatSAR(mostExpensive.annualCost)}/year — ` +
      `a difference of ${formatSAR(savingsDiff)} annually. ` +
      `Consider balancing cost savings with headcount needs and employee satisfaction.`;
  }

  return {
    scenarios: sorted,
    cheapestScenario: cheapest.scenarioId,
    mostExpensiveScenario: mostExpensive.scenarioId,
    recommendation,
  };
}

/**
 * Generate a structured report from a simulation result.
 * Produces 5 sections: Executive Summary, Financial Impact, Department
 * Breakdown, Warnings & Considerations, and Recommendation. Suitable for
 * rendering in a UI dashboard or exporting as a document.
 */
export function generateSimulationReport(result: SimulationResult): {
  title: string;
  sections: { heading: string; content: string }[];
} {
  const { currentState: cur, projectedState: proj, impact, departmentImpact } = result;

  // Section 1: Executive Summary
  const execContent = result.summary;

  // Section 2: Financial Impact
  const finLines: string[] = [
    `Current Monthly Payroll: ${formatSAR(cur.monthlyTotal)}`,
    `Projected Monthly Payroll: ${formatSAR(proj.monthlyTotal)}`,
    `Monthly Difference: ${impact.monthlyDifference >= 0 ? '+' : ''}${formatSAR(impact.monthlyDifference)}`,
    `Annual Impact: ${impact.annualDifference >= 0 ? '+' : ''}${formatSAR(impact.annualDifference)} (${impact.percentageChange >= 0 ? '+' : ''}${impact.percentageChange}%)`,
    `GOSI Employer Impact: ${impact.gosiImpactMonthly >= 0 ? '+' : ''}${formatSAR(impact.gosiImpactMonthly)}/month`,
    `Headcount: ${cur.headcount} → ${proj.headcount} (${impact.headcountChange >= 0 ? '+' : ''}${impact.headcountChange})`,
    `Average Salary: ${formatSAR(cur.averageSalary)} → ${formatSAR(proj.averageSalary)}`,
    `Affected Employees: ${result.affectedEmployees} of ${result.totalEmployees}`,
  ];

  // Section 3: Department Breakdown
  const deptLines: string[] = departmentImpact.map(di =>
    `${di.department}: ${formatSAR(di.currentMonthly)} → ${formatSAR(di.projectedMonthly)} ` +
    `(${di.difference >= 0 ? '+' : ''}${formatSAR(di.difference)}, ${di.percentageChange >= 0 ? '+' : ''}${di.percentageChange}%)` +
    (di.headcountChange !== 0 ? ` [HC: ${di.headcountChange >= 0 ? '+' : ''}${di.headcountChange}]` : ''),
  );

  // Section 4: Warnings & Considerations
  const warnContent = result.warnings.length > 0
    ? result.warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')
    : 'No warnings — scenario is within normal parameters.';

  // Section 5: Recommendation
  let recContent: string;

  if (impact.percentageChange > 15) {
    recContent = 'This scenario has a significant cost impact exceeding 15%. Board-level approval is recommended before implementation. Consider phasing the changes over multiple periods to reduce budget shock.';
  } else if (impact.percentageChange > 5) {
    recContent = 'Moderate cost impact. Ensure the budget for the current fiscal period can accommodate the change. Coordinate with Finance to update forecasts.';
  } else if (impact.percentageChange < -10) {
    recContent = 'Significant cost savings projected. Verify that operational capacity and employee satisfaction are not adversely affected. Consider reinvesting a portion of savings into development programs.';
  } else {
    recContent = 'The projected impact is within normal operational range. Standard approval process applies.';
  }

  return {
    title: `Simulation Report: ${result.scenarioName}`,
    sections: [
      {
        heading: 'Executive Summary',
        content: execContent,
      },
      {
        heading: 'Financial Impact',
        content: finLines.join('\n'),
      },
      {
        heading: 'Department Breakdown',
        content: deptLines.length > 0 ? deptLines.join('\n') : 'No department-level changes.',
      },
      {
        heading: 'Warnings & Considerations',
        content: warnContent,
      },
      {
        heading: 'Recommendation',
        content: recContent,
      },
    ],
  };
}
