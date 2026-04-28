/**
 * CVision Integrations — GOSI Client
 *
 * GOSI contribution rates:
 *
 * SAUDI EMPLOYEES (base = min(basic + housing, 45000)):
 *   Pension (annuity): employer 9% + employee 9%
 *   SANED (unemployment): employer 0.75% + employee 0.75%
 *   Occupational Hazards:  employer 2%
 *   → Total: employer 11.75% + employee 9.75% = 21.5%
 *
 * NON-SAUDI EMPLOYEES:
 *   Occupational Hazards: employer 2% only
 *   → Total: employer 2%
 */

import { v4 as uuidv4 } from 'uuid';
import { IntegrationClient, type IntegrationClientConfig } from '../shared/api-client';
import type { FileExport } from '../shared/types';
import { GOSI_RATES } from '@/lib/cvision/gosi';

// ---------------------------------------------------------------------------
// Rates (July 2025)
// ---------------------------------------------------------------------------

export const GOSI_2025_RATES = {
  MAX_BASE: GOSI_RATES.MAX_SALARY,
  SAUDI: {
    ANNUITY_EMPLOYER: GOSI_RATES.PENSION_RATE,    // 9%
    ANNUITY_EMPLOYEE: GOSI_RATES.PENSION_RATE,    // 9%
    SANED_EMPLOYER: GOSI_RATES.SANED_RATE,        // 0.75%
    SANED_EMPLOYEE: GOSI_RATES.SANED_RATE,        // 0.75%
    HAZARD_EMPLOYER: GOSI_RATES.HAZARD_RATE,      // 2%
    get TOTAL_EMPLOYER() { return this.ANNUITY_EMPLOYER + this.SANED_EMPLOYER + this.HAZARD_EMPLOYER; }, // 11.75%
    get TOTAL_EMPLOYEE() { return this.ANNUITY_EMPLOYEE + this.SANED_EMPLOYEE; }, // 9.75%
  },
  NON_SAUDI: {
    HAZARD_EMPLOYER: GOSI_RATES.HAZARD_RATE,      // 2%
    TOTAL_EMPLOYER: GOSI_RATES.HAZARD_RATE,       // 2%
    TOTAL_EMPLOYEE: 0,
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GOSIEmployeeInput {
  nationalId: string;
  name: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  isSaudi: boolean;
  basicSalary: number;
  housingAllowance: number;
}

export interface GOSIContributionDetail {
  nationalId: string;
  name: string;
  isSaudi: boolean;
  basicSalary: number;
  housingAllowance: number;
  contributionBase: number;
  employer: {
    annuities: number;
    saned: number;
    hazard: number;
    total: number;
    rate: string;
  };
  employee: {
    annuities: number;
    saned: number;
    total: number;
    rate: string;
  };
  grandTotal: number;
}

export interface GOSIMonthlyReport {
  establishmentNumber: string;
  month: number;
  year: number;
  summary: {
    /** Headcount: ALL Saudi employees regardless of salary */
    totalSaudi: number;
    /** Headcount: ALL non-Saudi employees regardless of salary */
    totalNonSaudi: number;
    /** Headcount: ALL employees */
    totalEmployees: number;
    /** Saudi employees with salary data > 0 */
    saudiWithSalary: number;
    /** Non-Saudi employees with salary data > 0 */
    nonSaudiWithSalary: number;
    totalEmployerContribution: number;
    totalEmployeeContribution: number;
    totalContribution: number;
    saudiEmployerTotal: number;
    saudiEmployeeTotal: number;
    nonSaudiEmployerTotal: number;
    missingSalaryCount: number;
  };
  details: GOSIContributionDetail[];
  file: FileExport;
  deadline: { date: string; daysRemaining: number; isOverdue: boolean; label: string };
}

export interface GOSIRegistrationResult {
  registered: boolean;
  establishmentName?: string;
  subscriptionDate?: string;
  status?: string;
  simulated: boolean;
}

export interface GOSISubmissionResult {
  success: boolean;
  referenceNumber: string;
  dueDate: string;
  totalAmount: number;
  simulated: boolean;
}

// ---------------------------------------------------------------------------
// Pure calculation (no DB / network)
// ---------------------------------------------------------------------------

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculateGOSIContribution(emp: {
  basicSalary: number;
  housingAllowance: number;
  isSaudi: boolean;
}): GOSIContributionDetail['employer'] & { employeeTotal: number; employeeAnnuities: number; employeeSaned: number; base: number; grandTotal: number } {
  const raw = emp.basicSalary + emp.housingAllowance;
  const base = Math.min(raw, GOSI_2025_RATES.MAX_BASE);

  if (emp.isSaudi) {
    const annEmp = r2(base * GOSI_2025_RATES.SAUDI.ANNUITY_EMPLOYER);
    const sanEmp = r2(base * GOSI_2025_RATES.SAUDI.SANED_EMPLOYER);
    const hazard = r2(base * GOSI_2025_RATES.SAUDI.HAZARD_EMPLOYER);
    const annEe = r2(base * GOSI_2025_RATES.SAUDI.ANNUITY_EMPLOYEE);
    const sanEe = r2(base * GOSI_2025_RATES.SAUDI.SANED_EMPLOYEE);
    return {
      annuities: annEmp, saned: sanEmp, hazard, total: r2(annEmp + sanEmp + hazard), rate: '11.75%',
      employeeAnnuities: annEe, employeeSaned: sanEe, employeeTotal: r2(annEe + sanEe),
      base, grandTotal: r2(annEmp + sanEmp + hazard + annEe + sanEe),
    };
  }

  const hazard = r2(base * GOSI_2025_RATES.NON_SAUDI.HAZARD_EMPLOYER);
  return {
    annuities: 0, saned: 0, hazard, total: hazard, rate: '2%',
    employeeAnnuities: 0, employeeSaned: 0, employeeTotal: 0,
    base, grandTotal: hazard,
  };
}

/**
 * Build a full detail row for one employee.
 */
export function buildContributionDetail(emp: GOSIEmployeeInput): GOSIContributionDetail {
  const calc = calculateGOSIContribution(emp);
  return {
    nationalId: emp.nationalId,
    name: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
    isSaudi: emp.isSaudi,
    basicSalary: emp.basicSalary,
    housingAllowance: emp.housingAllowance,
    contributionBase: calc.base,
    employer: { annuities: calc.annuities, saned: calc.saned, hazard: calc.hazard, total: calc.total, rate: calc.rate },
    employee: { annuities: calc.employeeAnnuities, saned: calc.employeeSaned, total: calc.employeeTotal, rate: emp.isSaudi ? '9.75%' : '0%' },
    grandTotal: calc.grandTotal,
  };
}

// ---------------------------------------------------------------------------
// Deadline helper (15th of following month)
// ---------------------------------------------------------------------------

export function getGOSIDeadline(month: number, year: number) {
  const nm = month === 12 ? 1 : month + 1;
  const ny = month === 12 ? year + 1 : year;
  const deadline = new Date(ny, nm - 1, 15, 23, 59, 59);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isOverdue = daysRemaining < 0;
  let label: string;
  if (isOverdue) label = `OVERDUE by ${Math.abs(daysRemaining)} day(s)`;
  else if (daysRemaining <= 3) label = `Due in ${daysRemaining} day(s) — urgent`;
  else label = `Due in ${daysRemaining} day(s)`;
  return { date: deadline.toISOString().slice(0, 10), daysRemaining, isOverdue, label };
}

// ---------------------------------------------------------------------------
// Monthly report generation
// ---------------------------------------------------------------------------

export function generateGOSIMonthlyReport(params: {
  establishmentNumber: string;
  month: number;
  year: number;
  employees: GOSIEmployeeInput[];
}): GOSIMonthlyReport {
  const { establishmentNumber, month, year, employees } = params;

  // Headcount: ALL employees regardless of salary
  const allSaudi = employees.filter(e => e.isSaudi).length;
  const allNonSaudi = employees.length - allSaudi;

  // Build details for ALL employees — zero contributions for those without salary
  const withSalary = employees.filter(e => e.basicSalary > 0);
  const withoutSalary = employees.filter(e => !(e.basicSalary > 0));
  const missingSalaryCount = withoutSalary.length;

  const salaryDetails = withSalary.map(buildContributionDetail);
  const noSalaryDetails: GOSIContributionDetail[] = withoutSalary.map(emp => ({
    nationalId: emp.nationalId,
    name: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
    isSaudi: emp.isSaudi,
    basicSalary: 0,
    housingAllowance: 0,
    contributionBase: 0,
    employer: { annuities: 0, saned: 0, hazard: 0, total: 0, rate: emp.isSaudi ? '11.75%' : '2%' },
    employee: { annuities: 0, saned: 0, total: 0, rate: emp.isSaudi ? '9.75%' : '0%' },
    grandTotal: 0,
  }));
  const details = [...salaryDetails, ...noSalaryDetails];

  const saudiDetails = salaryDetails.filter(d => d.isSaudi);
  const nonSaudiDetails = salaryDetails.filter(d => !d.isSaudi);

  const summary = {
    totalSaudi: allSaudi,
    totalNonSaudi: allNonSaudi,
    totalEmployees: employees.length,
    saudiWithSalary: saudiDetails.length,
    nonSaudiWithSalary: nonSaudiDetails.length,
    totalEmployerContribution: r2(salaryDetails.reduce((s, d) => s + d.employer.total, 0)),
    totalEmployeeContribution: r2(salaryDetails.reduce((s, d) => s + d.employee.total, 0)),
    totalContribution: r2(salaryDetails.reduce((s, d) => s + d.grandTotal, 0)),
    saudiEmployerTotal: r2(saudiDetails.reduce((s, d) => s + d.employer.total, 0)),
    saudiEmployeeTotal: r2(saudiDetails.reduce((s, d) => s + d.employee.total, 0)),
    nonSaudiEmployerTotal: r2(nonSaudiDetails.reduce((s, d) => s + d.employer.total, 0)),
    missingSalaryCount,
  };

  // CSV only includes employees with actual contribution data
  const file = buildGOSICSV(establishmentNumber, month, year, salaryDetails);
  const deadline = getGOSIDeadline(month, year);

  return { establishmentNumber, month, year, summary, details, file, deadline };
}

function buildGOSICSV(estNum: string, month: number, year: number, details: GOSIContributionDetail[]): FileExport {
  const mm = String(month).padStart(2, '0');
  const headers = [
    'EstablishmentNumber', 'Month', 'Year', 'NationalID', 'EmployeeName',
    'IsSaudi', 'BasicSalary', 'HousingAllowance', 'ContributionBase',
    'Employer_Annuities', 'Employer_SANED', 'Employer_Hazard', 'Employer_Total',
    'Employee_Annuities', 'Employee_SANED', 'Employee_Total', 'GrandTotal',
  ];
  const rows = details.map(d => [
    estNum, mm, String(year), d.nationalId, csvEsc(d.name),
    d.isSaudi ? 'Y' : 'N', d.basicSalary.toFixed(2), d.housingAllowance.toFixed(2), d.contributionBase.toFixed(2),
    d.employer.annuities.toFixed(2), d.employer.saned.toFixed(2), d.employer.hazard.toFixed(2), d.employer.total.toFixed(2),
    d.employee.annuities.toFixed(2), d.employee.saned.toFixed(2), d.employee.total.toFixed(2), d.grandTotal.toFixed(2),
  ].join(','));

  return {
    filename: `GOSI_${estNum}_${year}${mm}.csv`,
    format: 'CSV',
    content: [headers.join(','), ...rows].join('\r\n'),
    mimeType: 'text/csv',
    recordCount: details.length,
    generatedAt: new Date().toISOString(),
  };
}

function csvEsc(s: string): string {
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------------------------------------------------------------------------
// GOSIClient (extends IntegrationClient)
// ---------------------------------------------------------------------------

export class GOSIClient extends IntegrationClient {
  constructor(config: Omit<IntegrationClientConfig, 'integrationId'>) {
    super({ ...config, integrationId: 'gosi' });
  }

  async verifyRegistration(nationalId: string): Promise<GOSIRegistrationResult> {
    const res = await this.request<GOSIRegistrationResult>('GET', `/api/v1/subscribers/${nationalId}`);
    return res.data;
  }

  async submitContributions(report: GOSIMonthlyReport): Promise<GOSISubmissionResult> {
    const res = await this.request<GOSISubmissionResult>('POST', '/api/v1/contributions/submit', {
      establishmentNumber: report.establishmentNumber,
      month: report.month,
      year: report.year,
      totalAmount: report.summary.totalContribution,
      employeeCount: report.summary.totalEmployees,
    });
    return res.data;
  }

  protected async simulateResponse(method: string, path: string, data?: any): Promise<any> {
    await new Promise(r => setTimeout(r, 150 + Math.random() * 250));

    if (path.includes('/subscribers/')) {
      const nid = path.split('/').pop() || '';
      return {
        registered: true,
        establishmentName: 'Thea Health',
        subscriptionDate: '2023-01-15',
        status: 'ACTIVE',
        simulated: true,
      } satisfies GOSIRegistrationResult;
    }

    if (path.includes('/contributions/submit')) {
      const ref = `GOSI-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const deadline = getGOSIDeadline(data?.month || new Date().getMonth() + 1, data?.year || new Date().getFullYear());
      return {
        success: true,
        referenceNumber: ref,
        dueDate: deadline.date,
        totalAmount: data?.totalAmount || 0,
        simulated: true,
      } satisfies GOSISubmissionResult;
    }

    return { success: true, simulated: true };
  }
}
