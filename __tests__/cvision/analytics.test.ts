/**
 * CVision Analytics Engine & What-If Simulator - Unit Tests
 *
 * 33 tests covering:
 *   Analytics Engine (23):  Absence 6, Turnover 6, Payroll 3, Workforce 4, Retention Risk 3, Executive Summary 1
 *   What-If Simulator (10): Build State 2, Salary 3, Headcount 2, Compare 2, Report 1
 *
 * Both modules are pure computation -- no DB, no AI API calls, no side effects.
 */

import { describe, it, expect } from 'vitest';

import {
  analyzeAbsencePatterns,
  analyzeTurnover,
  analyzePayrollTrends,
  generateWorkforceInsights,
  calculateRetentionRisk,
  generateExecutiveSummary,
  TENURE_BANDS,
  AGE_BANDS,
  type DateRange,
  type AbsenceAnalytics,
  type TurnoverAnalytics,
  type PayrollTrend,
  type WorkforceInsights,
} from '../../lib/cvision/analytics/analytics-engine';

import {
  buildCurrentState,
  simulateSalaryAdjustment,
  simulateHeadcountChange,
  simulateAllowanceChange,
  simulateOvertimeChange,
  compareScenarios,
  generateSimulationReport,
  GOSI_RATES,
  type CurrentState,
  type SimulationResult,
} from '../../lib/cvision/analytics/what-if-simulator';

// =============================================================================
// Shared Mock Data
// =============================================================================

/**
 * 6 mock employees:
 *   emp-1  Ahmed   IT       Saudi   ACTIVE       hired 2020-01-15  M  DOB 1990-05-10
 *   emp-2  Sara    HR       Saudi   ACTIVE       hired 2021-06-01  F  DOB 1988-08-22
 *   emp-3  John    IT       US      ACTIVE       hired 2022-03-10  M  DOB 1985-03-15
 *   emp-4  Fatima  Finance  Saudi   PROBATION    hired 2024-01-05  F  DOB 1995-11-30
 *   emp-5  Omar    IT       Saudi   RESIGNED     hired 2019-07-20  M  DOB 1992-02-14  resigned 2024-04-15
 *   emp-6  Maria   HR       PH      TERMINATED   hired 2023-01-10  F  DOB 1993-09-25  terminated 2024-03-20
 */

const SNAPSHOT_DATE = new Date('2024-06-01T00:00:00Z');

const MOCK_EMPLOYEES = [
  {
    id: 'emp-1',
    name: 'Ahmed Al-Saud',
    departmentId: 'IT',
    jobTitleId: 'jt-dev',
    nationality: 'SA',
    gender: 'Male',
    dateOfBirth: new Date('1990-05-10'),
    status: 'ACTIVE',
    hiredAt: new Date('2020-01-15'),
    contractEndDate: new Date('2025-01-15'),
    probationEndDate: null,
  },
  {
    id: 'emp-2',
    name: 'Sara Al-Harbi',
    departmentId: 'HR',
    jobTitleId: 'jt-hr-spec',
    nationality: 'Saudi',
    gender: 'Female',
    dateOfBirth: new Date('1988-08-22'),
    status: 'ACTIVE',
    hiredAt: new Date('2021-06-01'),
    contractEndDate: new Date('2024-07-01'),
    probationEndDate: null,
  },
  {
    id: 'emp-3',
    name: 'John Smith',
    departmentId: 'IT',
    jobTitleId: 'jt-dev',
    nationality: 'US',
    gender: 'Male',
    dateOfBirth: new Date('1985-03-15'),
    status: 'ACTIVE',
    hiredAt: new Date('2022-03-10'),
    contractEndDate: new Date('2026-03-10'),
    probationEndDate: null,
  },
  {
    id: 'emp-4',
    name: 'Fatima Al-Qahtani',
    departmentId: 'Finance',
    jobTitleId: 'jt-accountant',
    nationality: 'Saudi',
    gender: 'Female',
    dateOfBirth: new Date('1995-11-30'),
    status: 'PROBATION',
    hiredAt: new Date('2024-01-05'),
    contractEndDate: new Date('2026-01-05'),
    probationEndDate: new Date('2024-07-05'),
  },
  {
    id: 'emp-5',
    name: 'Omar Al-Fahd',
    departmentId: 'IT',
    jobTitleId: 'jt-dev',
    nationality: 'SAUDI',
    gender: 'Male',
    dateOfBirth: new Date('1992-02-14'),
    status: 'RESIGNED',
    hiredAt: new Date('2019-07-20'),
    resignedAt: new Date('2024-04-15'),
    contractEndDate: null,
    probationEndDate: null,
  },
  {
    id: 'emp-6',
    name: 'Maria Santos',
    departmentId: 'HR',
    jobTitleId: 'jt-hr-asst',
    nationality: 'PH',
    gender: 'Female',
    dateOfBirth: new Date('1993-09-25'),
    status: 'TERMINATED',
    hiredAt: new Date('2023-01-10'),
    terminatedAt: new Date('2024-03-20'),
    contractEndDate: null,
    probationEndDate: null,
    statusReason: 'Poor performance',
  },
];

/** 7 leave records for various employees */
const MOCK_LEAVE_RECORDS = [
  { employeeId: 'emp-1', type: 'ANNUAL',  status: 'APPROVED', startDate: new Date('2024-02-10'), endDate: new Date('2024-02-14'), totalDays: 5 },
  { employeeId: 'emp-1', type: 'SICK',    status: 'APPROVED', startDate: new Date('2024-03-05'), endDate: new Date('2024-03-07'), totalDays: 3 },
  { employeeId: 'emp-2', type: 'ANNUAL',  status: 'APPROVED', startDate: new Date('2024-04-01'), endDate: new Date('2024-04-05'), totalDays: 5 },
  { employeeId: 'emp-3', type: 'SICK',    status: 'APPROVED', startDate: new Date('2024-01-15'), endDate: new Date('2024-01-16'), totalDays: 2 },
  { employeeId: 'emp-3', type: 'ANNUAL',  status: 'TAKEN',   startDate: new Date('2024-05-01'), endDate: new Date('2024-05-03'), totalDays: 3 },
  { employeeId: 'emp-4', type: 'SICK',    status: 'APPROVED', startDate: new Date('2024-02-20'), endDate: new Date('2024-02-21'), totalDays: 2 },
  { employeeId: 'emp-1', type: 'UNPAID',  status: 'PENDING',  startDate: new Date('2024-05-10'), endDate: new Date('2024-05-12'), totalDays: 3 },
];

/** 4 attendance records marking absences and late arrivals */
const MOCK_ATTENDANCE_RECORDS = [
  { employeeId: 'emp-1', date: new Date('2024-03-11'), status: 'ABSENT' },
  { employeeId: 'emp-1', date: new Date('2024-03-12'), status: 'ABSENT' },
  { employeeId: 'emp-1', date: new Date('2024-03-13'), status: 'ABSENT' },
  { employeeId: 'emp-2', date: new Date('2024-04-08'), status: 'LATE', lateMinutes: 30 },
  { employeeId: 'emp-2', date: new Date('2024-04-09'), status: 'LATE', lateMinutes: 15 },
  { employeeId: 'emp-3', date: new Date('2024-01-22'), status: 'ABSENT' },
  { employeeId: 'emp-3', date: new Date('2024-02-05'), status: 'EARLY_LEAVE', earlyLeaveMinutes: 60 },
  { employeeId: 'emp-4', date: new Date('2024-02-19'), status: 'ABSENT' },
];

/** 6 months of payroll run data (Jan-Jun 2024) */
const MOCK_PAYROLL_RUNS = [
  { period: '2024-01', status: 'paid',     totalsJson: { totalGross: 200000, totalNet: 175000, employeeCount: 4, totalAllowances: 40000, totalDeductions: 25000 } },
  { period: '2024-02', status: 'approved', totalsJson: { totalGross: 205000, totalNet: 179000, employeeCount: 4, totalAllowances: 41000, totalDeductions: 26000 } },
  { period: '2024-03', status: 'paid',     totalsJson: { totalGross: 210000, totalNet: 183000, employeeCount: 4, totalAllowances: 42000, totalDeductions: 27000 } },
  { period: '2024-04', status: 'paid',     totalsJson: { totalGross: 215000, totalNet: 187000, employeeCount: 4, totalAllowances: 43000, totalDeductions: 28000 } },
  { period: '2024-05', status: 'approved', totalsJson: { totalGross: 220000, totalNet: 192000, employeeCount: 4, totalAllowances: 44000, totalDeductions: 28000 } },
  { period: '2024-06', status: 'paid',     totalsJson: { totalGross: 225000, totalNet: 196000, employeeCount: 4, totalAllowances: 45000, totalDeductions: 29000 } },
];

/** Standard date range for analytics: Jan - Jun 2024 */
const DATE_RANGE: DateRange = {
  start: new Date('2024-01-01'),
  end: new Date('2024-06-30'),
};

/** Mock employees for What-If Simulator (salary-oriented) */
const SIMULATOR_EMPLOYEES = [
  { id: 'emp-1', name: 'Ahmed',  department: 'IT',      grade: 'G5', basicSalary: 12000, allowances: [{ type: 'HOUSING', amount: 3000 }, { type: 'TRANSPORT', amount: 1000 }] },
  { id: 'emp-2', name: 'Sara',   department: 'HR',      grade: 'G4', basicSalary: 10000, allowances: [{ type: 'HOUSING', amount: 2500 }, { type: 'TRANSPORT', amount: 800 }] },
  { id: 'emp-3', name: 'John',   department: 'IT',      grade: 'G5', basicSalary: 15000, allowances: [{ type: 'HOUSING', amount: 3750 }, { type: 'TRANSPORT', amount: 1000 }] },
  { id: 'emp-4', name: 'Fatima', department: 'Finance', grade: 'G3', basicSalary: 8000,  allowances: [{ type: 'HOUSING', amount: 2000 }, { type: 'TRANSPORT', amount: 600 }] },
  { id: 'emp-5', name: 'Khalid', department: 'IT',      grade: 'G6', basicSalary: 20000, allowances: [{ type: 'HOUSING', amount: 5000 }, { type: 'TRANSPORT', amount: 1500 }] },
];

// =============================================================================
// Analytics Engine Tests
// =============================================================================

describe('Analytics Engine', () => {
  // ─── Absence Analysis (6 tests) ─────────────────────────────────────────

  describe('analyzeAbsencePatterns', () => {
    const employees = MOCK_EMPLOYEES
      .filter(e => ['ACTIVE', 'PROBATION'].includes(e.status))
      .map(e => ({ id: e.id, name: e.name, departmentId: e.departmentId }));

    function runAbsenceAnalysis(): AbsenceAnalytics {
      return analyzeAbsencePatterns({
        employees,
        attendanceRecords: MOCK_ATTENDANCE_RECORDS,
        leaveRecords: MOCK_LEAVE_RECORDS,
        dateRange: DATE_RANGE,
      });
    }

    it('should return correct totalEmployees and totalAbsenceDays', () => {
      const result = runAbsenceAnalysis();
      // Active employees: emp-1, emp-2, emp-3, emp-4 (4 employees)
      expect(result.totalEmployees).toBe(4);
      // ABSENT records: emp-1 has 3, emp-3 has 1, emp-4 has 1 = 5 total
      expect(result.totalAbsenceDays).toBe(5);
    });

    it('should calculate overallAbsenteeismRate as percentage', () => {
      const result = runAbsenceAnalysis();
      // totalMonths = 6, workingDaysPerMonth = 22 => totalWorkingDays = 132
      // totalEmployeeWorkingDays = 4 * 132 = 528
      // overallAbsenteeismRate = (5 / 528) * 100 = 0.95%
      expect(result.overallAbsenteeismRate).toBeGreaterThan(0);
      expect(result.overallAbsenteeismRate).toBeLessThan(5);
    });

    it('should group absences byDepartment with absenteeismRate and employeeCount', () => {
      const result = runAbsenceAnalysis();
      expect(result.byDepartment).toHaveProperty('IT');
      expect(result.byDepartment).toHaveProperty('HR');
      expect(result.byDepartment.IT.employeeCount).toBe(2); // emp-1, emp-3
      expect(result.byDepartment.IT.totalAbsences).toBe(4); // emp-1: 3, emp-3: 1
      expect(result.byDepartment.IT.absenteeismRate).toBeGreaterThan(0);
    });

    it('should track approved leave byType (ANNUAL, SICK)', () => {
      const result = runAbsenceAnalysis();
      // ANNUAL: emp-1(5) + emp-2(5) = 10 (emp-3 TAKEN not APPROVED)
      // SICK:   emp-1(3) + emp-3(2) + emp-4(2) = 7
      // UNPAID: emp-1(3) is PENDING, so excluded
      expect(result.byType.ANNUAL).toBe(10);
      expect(result.byType.SICK).toBe(7);
      expect(result.byType.UNPAID).toBeUndefined(); // Only APPROVED/TAKEN
    });

    it('should detect consecutive absence streak for high-risk flagging', () => {
      const result = runAbsenceAnalysis();
      // emp-1 has 3 consecutive absences (Mar 11, 12, 13)
      // The streak threshold is 3, so emp-1 should be high risk
      const emp1Pattern = result.highRiskEmployees.find(p => p.employeeId === 'emp-1');
      // emp-1 has 3 consecutive absences (each 1 day apart), streak = 3
      // isHighRisk triggers when consecutiveAbsenceStreak >= 3
      expect(emp1Pattern).toBeDefined();
      if (emp1Pattern) {
        expect(emp1Pattern.consecutiveAbsenceStreak).toBeGreaterThanOrEqual(3);
        expect(emp1Pattern.isHighRisk).toBe(true);
        expect(emp1Pattern.riskFactors.length).toBeGreaterThan(0);
      }
    });

    it('should produce byDayOfWeek array of length 7 and byMonth array of length 12', () => {
      const result = runAbsenceAnalysis();
      expect(result.byDayOfWeek).toHaveLength(7);
      expect(result.byMonth).toHaveLength(12);
      // All values should be non-negative
      result.byDayOfWeek.forEach(v => expect(v).toBeGreaterThanOrEqual(0));
      result.byMonth.forEach(v => expect(v).toBeGreaterThanOrEqual(0));
      // Sum of byDayOfWeek should equal totalAbsenceDays
      const sumDow = result.byDayOfWeek.reduce((a, b) => a + b, 0);
      expect(sumDow).toBe(result.totalAbsenceDays);
    });
  });

  // ─── Turnover Analysis (6 tests) ────────────────────────────────────────

  describe('analyzeTurnover', () => {
    function runTurnoverAnalysis(): TurnoverAnalytics {
      return analyzeTurnover({
        employees: MOCK_EMPLOYEES as Record<string, unknown>[],
        dateRange: DATE_RANGE,
      });
    }

    it('should detect resignations and terminations within the date range', () => {
      const result = runTurnoverAnalysis();
      // emp-5 resigned 2024-04-15 (within range) => 1 resignation
      // emp-6 terminated 2024-03-20 (within range) => 1 termination
      expect(result.resignations).toBe(1);
      expect(result.terminations).toBe(1);
      expect(result.totalSeparations).toBe(2);
    });

    it('should calculate turnoverRate as percentage of average headcount', () => {
      const result = runTurnoverAnalysis();
      // turnoverRate = (totalSeparations / averageHeadcount) * 100
      // averageHeadcount uses start + end headcount / 2
      expect(result.turnoverRate).toBeGreaterThan(0);
      expect(result.turnoverRate).toBeLessThan(100);
    });

    it('should separate voluntary vs involuntary turnover rates', () => {
      const result = runTurnoverAnalysis();
      // voluntaryTurnoverRate = resignations / avgHeadcount * 100
      // involuntaryTurnoverRate = terminations / avgHeadcount * 100
      expect(result.voluntaryTurnoverRate).toBeGreaterThan(0);
      expect(result.involuntaryTurnoverRate).toBeGreaterThan(0);
      // Sum should approximately equal total turnover rate
      const sumRates = result.voluntaryTurnoverRate + result.involuntaryTurnoverRate;
      expect(Math.abs(sumRates - result.turnoverRate)).toBeLessThan(0.1);
    });

    it('should calculate averageTenureMonths for separated employees', () => {
      const result = runTurnoverAnalysis();
      // emp-5: hired 2019-07-20, resigned 2024-04-15 => ~57 months
      // emp-6: hired 2023-01-10, terminated 2024-03-20 => ~14 months
      // Average = (57 + 14) / 2 = ~35.5 months
      expect(result.averageTenureMonths).toBeGreaterThan(20);
      expect(result.averageTenureMonths).toBeLessThan(60);
    });

    it('should provide retentionRate as 100 minus turnoverRate', () => {
      const result = runTurnoverAnalysis();
      expect(result.retentionRate).toBeCloseTo(100 - result.turnoverRate, 1);
    });

    it('should classify separations into tenure bands', () => {
      const result = runTurnoverAnalysis();
      // Must have all 5 tenure band keys
      for (const key of Object.keys(TENURE_BANDS)) {
        expect(result.byTenureBand).toHaveProperty(key);
      }
      // Total across bands should equal totalSeparations
      const bandSum = Object.values(result.byTenureBand).reduce((a, b) => a + b, 0);
      expect(bandSum).toBe(result.totalSeparations);
    });
  });

  // ─── Payroll Trends (3 tests) ───────────────────────────────────────────

  describe('analyzePayrollTrends', () => {
    function runPayrollTrends(): PayrollTrend[] {
      return analyzePayrollTrends({
        payrollRuns: MOCK_PAYROLL_RUNS,
        dateRange: DATE_RANGE,
      });
    }

    it('should return one PayrollTrend per valid payroll run sorted by period', () => {
      const trends = runPayrollTrends();
      // 6 runs, all paid/approved within range
      expect(trends.length).toBe(6);
      // Sorted ascending
      for (let i = 1; i < trends.length; i++) {
        expect(trends[i].period > trends[i - 1].period).toBe(true);
      }
    });

    it('should calculate GOSI employer cost per period capped at 45,000 SAR', () => {
      const trends = runPayrollTrends();
      for (const trend of trends) {
        // GOSI employer cost should be positive
        expect(trend.gosiEmployerCost).toBeGreaterThan(0);
        // Per employee, the capped gross should not exceed 45000 * 11.75% = 5287.50
        const maxPerEmployee = 45000 * 0.1175;
        const maxTotal = maxPerEmployee * trend.employeeCount;
        expect(trend.gosiEmployerCost).toBeLessThanOrEqual(maxTotal + 0.01);
      }
    });

    it('should compute changeFromPrevious as 0 for the first period and percentages thereafter', () => {
      const trends = runPayrollTrends();
      // First period: all changes should be 0
      expect(trends[0].changeFromPrevious.grossChange).toBe(0);
      expect(trends[0].changeFromPrevious.netChange).toBe(0);
      expect(trends[0].changeFromPrevious.headcountChange).toBe(0);
      // Second period onward: grossChange should be non-zero (payroll is increasing)
      expect(trends[1].changeFromPrevious.grossChange).not.toBe(0);
      // Gross increased from 200000 to 205000 => 2.5% increase
      expect(trends[1].changeFromPrevious.grossChange).toBe(2.5);
    });
  });

  // ─── Workforce Insights (4 tests) ───────────────────────────────────────

  describe('generateWorkforceInsights', () => {
    function runWorkforceInsights(): WorkforceInsights {
      return generateWorkforceInsights({
        employees: MOCK_EMPLOYEES as Record<string, unknown>[],
        snapshotDate: SNAPSHOT_DATE,
      });
    }

    it('should count active and probation employees correctly', () => {
      const result = runWorkforceInsights();
      // ACTIVE: emp-1, emp-2, emp-3 = 3
      // PROBATION: emp-4 = 1
      // Excluded: emp-5 (RESIGNED), emp-6 (TERMINATED)
      expect(result.activeCount).toBe(3);
      expect(result.probationCount).toBe(1);
      expect(result.totalHeadcount).toBe(4);
    });

    it('should calculate saudizationRate from Saudi nationalities', () => {
      const result = runWorkforceInsights();
      // Active Saudi: emp-1 (SA), emp-2 (Saudi), emp-4 (Saudi female variant)
      // Non-Saudi active: emp-3 (US)
      // saudizationRate = 3/4 * 100 = 75%
      expect(result.saudizationRate).toBe(75);
    });

    it('should distribute employees into ageBands and tenureBands', () => {
      const result = runWorkforceInsights();
      // Age bands should have all 5 keys
      for (const key of Object.keys(AGE_BANDS)) {
        expect(result.ageBands).toHaveProperty(key);
      }
      // Tenure bands should have all 5 keys
      for (const key of Object.keys(TENURE_BANDS)) {
        expect(result.tenureBands).toHaveProperty(key);
      }
      // Sum of age bands should equal count of employees with DOB
      const ageBandSum = Object.values(result.ageBands).reduce((a, b) => a + b, 0);
      expect(ageBandSum).toBe(4); // All 4 active employees have DOB
    });

    it('should detect contracts expiring within 90 days and probation ending within 30 days', () => {
      const result = runWorkforceInsights();
      // Snapshot: 2024-06-01
      // emp-2 contractEndDate: 2024-07-01 (30 days away, within 90)
      // emp-4 probationEndDate: 2024-07-05 (34 days away, outside 30-day window)
      expect(result.contractExpiringIn90Days).toBe(1); // emp-2
      // emp-4 probation ends 2024-07-05, which is 34 days from June 1 => outside 30 days
      expect(result.probationEndingIn30Days).toBe(0);
    });
  });

  // ─── Retention Risk (3 tests) ───────────────────────────────────────────

  describe('calculateRetentionRisk', () => {
    it('should return LOW risk for a healthy employee with no risk factors', () => {
      const result = calculateRetentionRisk({
        employee: {
          id: 'emp-1',
          name: 'Ahmed',
          departmentId: 'IT',
          hiredAt: new Date('2020-01-15'),
          status: 'ACTIVE',
          contractEndDate: new Date('2025-12-31'),
        },
        attendanceRecords: [
          { status: 'PRESENT' },
          { status: 'PRESENT' },
          { status: 'PRESENT' },
        ],
        leaveRecords: [
          { type: 'ANNUAL', totalDays: 5 },
        ],
        recentViolations: [],
      });

      expect(result.riskLevel).toBe('LOW');
      expect(result.riskScore).toBeLessThanOrEqual(25);
      expect(result.factors.length).toBe(0);
      expect(result.recommendation).toBeTruthy();
    });

    it('should flag HIGH risk for employee with multiple risk factors', () => {
      // Use a hire date that is < 6 months from NOW so short-tenure triggers
      const now = new Date();
      const recentHireDate = new Date(now);
      recentHireDate.setMonth(recentHireDate.getMonth() - 3); // 3 months ago

      const result = calculateRetentionRisk({
        employee: {
          id: 'emp-new',
          name: 'New Hire',
          departmentId: 'IT',
          hiredAt: recentHireDate,    // Short tenure < 6 months => +20
          status: 'PROBATION',        // Probation period => +10
        },
        attendanceRecords: [
          // 3 ABSENT out of 10 records => 30% absenteeism rate (>10% threshold) => +15
          { status: 'ABSENT' },
          { status: 'ABSENT' },
          { status: 'ABSENT' },
          { status: 'PRESENT' },
          { status: 'PRESENT' },
          { status: 'PRESENT' },
          { status: 'PRESENT' },
          { status: 'PRESENT' },
          { status: 'PRESENT' },
          { status: 'PRESENT' },
        ],
        leaveRecords: [],
        recentViolations: [
          { type: 'TARDINESS', severity: 'MODERATE' }, // +5
        ],
      });

      // Short tenure +20, high absenteeism +15, probation +10, violations +5 = 50
      expect(result.riskScore).toBeGreaterThanOrEqual(40);
      expect(['MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.riskLevel);
      expect(result.factors.length).toBeGreaterThanOrEqual(3);
    });

    it('should cap risk score at 100 even with many risk factors', () => {
      // Use dates relative to NOW so the risk calculations are correct
      const now = new Date();
      const recentHireDate = new Date(now);
      recentHireDate.setMonth(recentHireDate.getMonth() - 2); // 2 months ago => short tenure +20

      const soonExpiryDate = new Date(now);
      soonExpiryDate.setDate(soonExpiryDate.getDate() + 30); // Expiring in 30 days => +20

      const result = calculateRetentionRisk({
        employee: {
          id: 'emp-critical',
          name: 'Critical Employee',
          departmentId: 'HR',
          hiredAt: recentHireDate,       // Short tenure < 6 months => +20
          status: 'PROBATION',           // +10
          contractEndDate: soonExpiryDate, // Expiring within 60 days => +20
        },
        attendanceRecords: [
          // 5 absent out of 15 => 33% absenteeism => +15
          { status: 'ABSENT' }, { status: 'ABSENT' }, { status: 'ABSENT' },
          { status: 'ABSENT' }, { status: 'ABSENT' },
          // 6 late => +10
          { status: 'LATE' }, { status: 'LATE' }, { status: 'LATE' },
          { status: 'LATE' }, { status: 'LATE' }, { status: 'LATE' },
          { status: 'PRESENT' }, { status: 'PRESENT' },
          { status: 'PRESENT' }, { status: 'PRESENT' },
        ],
        leaveRecords: [
          { type: 'SICK', totalDays: 20 }, // Excessive sick leave => +10
        ],
        recentViolations: [
          { type: 'HARASSMENT', severity: 'SEVERE' }, // Severe => +15
          { type: 'TARDINESS', severity: 'MODERATE' }, // Moderate => +5
        ],
      });

      // Total would be: 20+10+20+15+10+10+20 = 105, but capped at 100
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(result.riskLevel).toBe('CRITICAL');
    });
  });

  // ─── Executive Summary (1 test) ─────────────────────────────────────────

  describe('generateExecutiveSummary', () => {
    it('should produce keyMetrics, alerts, recommendations, and bilingual summary', () => {
      // Build the required inputs
      const activeEmps = MOCK_EMPLOYEES
        .filter(e => ['ACTIVE', 'PROBATION'].includes(e.status))
        .map(e => ({ id: e.id, name: e.name, departmentId: e.departmentId }));

      const absenceAnalytics = analyzeAbsencePatterns({
        employees: activeEmps,
        attendanceRecords: MOCK_ATTENDANCE_RECORDS,
        leaveRecords: MOCK_LEAVE_RECORDS,
        dateRange: DATE_RANGE,
      });

      const turnoverAnalytics = analyzeTurnover({
        employees: MOCK_EMPLOYEES as Record<string, unknown>[],
        dateRange: DATE_RANGE,
      });

      const payrollTrends = analyzePayrollTrends({
        payrollRuns: MOCK_PAYROLL_RUNS,
        dateRange: DATE_RANGE,
      });

      const workforceInsights = generateWorkforceInsights({
        employees: MOCK_EMPLOYEES as Record<string, unknown>[],
        snapshotDate: SNAPSHOT_DATE,
      });

      const result = generateExecutiveSummary({
        absenceAnalytics,
        turnoverAnalytics,
        payrollTrends,
        workforceInsights,
      });

      // Structure checks
      expect(result.summary).toBeTruthy();
      expect(result.keyMetrics.length).toBeGreaterThanOrEqual(5);
      expect(Array.isArray(result.alerts)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);

      // Key metrics should include Total Headcount and Turnover Rate
      const headcountMetric = result.keyMetrics.find(m => m.label === 'Total Headcount');
      expect(headcountMetric).toBeDefined();
      expect(headcountMetric!.value).toBe('4');

      const turnoverMetric = result.keyMetrics.find(m => m.label === 'Turnover Rate');
      expect(turnoverMetric).toBeDefined();

      // Saudization metric
      const saudizationMetric = result.keyMetrics.find(m => m.label === 'Saudization Rate');
      expect(saudizationMetric).toBeDefined();

      // All alerts should have severity and message
      for (const alert of result.alerts) {
        expect(['INFO', 'WARNING', 'CRITICAL']).toContain(alert.severity);
        expect(alert.message).toBeTruthy();
      }

      // All recommendations should have priority and action
      for (const rec of result.recommendations) {
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(rec.priority);
        expect(rec.action).toBeTruthy();
      }
    });
  });
});

// =============================================================================
// What-If Simulator Tests
// =============================================================================

describe('What-If Simulator', () => {
  // Reusable current state built from mock data
  let currentState: CurrentState;

  function refreshState(): CurrentState {
    return buildCurrentState(SIMULATOR_EMPLOYEES);
  }

  // ─── Build State (2 tests) ──────────────────────────────────────────────

  describe('buildCurrentState', () => {
    it('should calculate per-employee totalPackage as basicSalary + allowances', () => {
      const state = refreshState();
      expect(state.employees.length).toBe(5);

      // emp-1: 12000 + 3000 + 1000 = 16000
      const ahmed = state.employees.find(e => e.id === 'emp-1')!;
      expect(ahmed.totalPackage).toBe(16000);

      // emp-4: 8000 + 2000 + 600 = 10600
      const fatima = state.employees.find(e => e.id === 'emp-4')!;
      expect(fatima.totalPackage).toBe(10600);
    });

    it('should calculate GOSI contributions based on basic + housing, capped at 45,000', () => {
      const state = refreshState();

      // emp-5: basicSalary 20000 + housing 5000 = 25000 (under cap)
      // gosiEmployer = 25000 * 0.1175 = 2937.50
      const khalid = state.employees.find(e => e.id === 'emp-5')!;
      expect(khalid.gosiEmployer).toBe(2937.5);
      expect(khalid.gosiEmployee).toBe(2437.5); // 25000 * 0.0975 = 2437.50

      // emp-1: 12000 + 3000 = 15000 (under cap)
      // gosiEmployer = 15000 * 0.1175 = 1762.50
      const ahmed = state.employees.find(e => e.id === 'emp-1')!;
      expect(ahmed.gosiEmployer).toBe(1762.5);

      // Total GOSI employer should be sum of all employees
      const totalGosiExpected = state.employees.reduce((s, e) => s + e.gosiEmployer, 0);
      expect(state.totalGosiEmployer).toBeCloseTo(totalGosiExpected, 2);

      // Monthly payroll total should be sum of all totalPackage
      const payrollExpected = state.employees.reduce((s, e) => s + e.totalPackage, 0);
      expect(state.monthlyPayrollTotal).toBeCloseTo(payrollExpected, 2);
      expect(state.annualPayrollTotal).toBeCloseTo(payrollExpected * 12, 2);
    });
  });

  // ─── Salary Adjustment (3 tests) ────────────────────────────────────────

  describe('simulateSalaryAdjustment', () => {
    it('should apply percentage increase to all employees and recalculate totals', () => {
      currentState = refreshState();
      const result = simulateSalaryAdjustment(currentState, {
        scope: 'ALL',
        adjustmentType: 'PERCENTAGE',
        adjustmentValue: 10,
        effectiveDate: new Date('2024-07-01'),
        includeAllowances: false,
      });

      expect(result.affectedEmployees).toBe(5);
      expect(result.impact.percentageChange).toBeGreaterThan(0);
      // Monthly difference should be positive (raise)
      expect(result.impact.monthlyDifference).toBeGreaterThan(0);
      // Projected monthly should be higher than current
      expect(result.projectedState.monthlyTotal).toBeGreaterThan(result.currentState.monthlyTotal);
      // Headcount should not change for salary adjustment
      expect(result.impact.headcountChange).toBe(0);
    });

    it('should apply fixed amount adjustment scoped to a department', () => {
      currentState = refreshState();
      const result = simulateSalaryAdjustment(currentState, {
        scope: 'DEPARTMENT',
        department: 'IT',
        adjustmentType: 'FIXED_AMOUNT',
        adjustmentValue: 2000,
        effectiveDate: new Date('2024-07-01'),
        includeAllowances: false,
      });

      // IT has 3 employees: emp-1, emp-3, emp-5
      expect(result.affectedEmployees).toBe(3);
      // Monthly increase: 3 * 2000 = 6000
      expect(result.impact.monthlyDifference).toBe(6000);
      expect(result.impact.annualDifference).toBe(72000);
    });

    it('should warn when total payroll increase exceeds 15%', () => {
      currentState = refreshState();
      const result = simulateSalaryAdjustment(currentState, {
        scope: 'ALL',
        adjustmentType: 'PERCENTAGE',
        adjustmentValue: 20, // 20% raise => exceeds 15% threshold
        effectiveDate: new Date('2024-07-01'),
        includeAllowances: true,
      });

      expect(result.warnings.length).toBeGreaterThan(0);
      const hasThresholdWarning = result.warnings.some(w => w.includes('15%'));
      expect(hasThresholdWarning).toBe(true);
    });
  });

  // ─── Headcount Change (2 tests) ─────────────────────────────────────────

  describe('simulateHeadcountChange', () => {
    it('should simulate hiring new employees and increase headcount', () => {
      currentState = refreshState();
      const result = simulateHeadcountChange(currentState, {
        department: 'HR',
        action: 'HIRE',
        count: 3,
        averageSalary: 9000,
        effectiveDate: new Date('2024-07-01'),
      });

      expect(result.impact.headcountChange).toBe(3);
      expect(result.projectedState.headcount).toBe(8); // 5 + 3
      expect(result.impact.monthlyDifference).toBeGreaterThan(0);
      expect(result.affectedEmployees).toBe(3);
      // Summary should mention hiring
      expect(result.summary.toLowerCase()).toContain('hiring');
    });

    it('should warn about critical understaffing when terminating leaves < 3 remaining', () => {
      currentState = refreshState();
      // HR has only 1 employee (emp-2: Sara), terminate 1
      const result = simulateHeadcountChange(currentState, {
        department: 'HR',
        action: 'TERMINATE',
        count: 1,
        effectiveDate: new Date('2024-07-01'),
      });

      // After terminating 1 from HR (which has 1), 0 remain
      expect(result.impact.headcountChange).toBe(-1);
      // Warning about critical understaffing (< 3 remaining)
      const hasUnderstaffWarning = result.warnings.some(w =>
        w.toLowerCase().includes('understaffing') || w.toLowerCase().includes('critical')
      );
      expect(hasUnderstaffWarning).toBe(true);
    });
  });

  // ─── Compare Scenarios (2 tests) ────────────────────────────────────────

  describe('compareScenarios', () => {
    it('should rank scenarios by annual cost and identify cheapest/most expensive', () => {
      currentState = refreshState();

      // Scenario A: 10% salary raise
      const scenarioA = simulateSalaryAdjustment(currentState, {
        scope: 'ALL',
        adjustmentType: 'PERCENTAGE',
        adjustmentValue: 10,
        effectiveDate: new Date('2024-07-01'),
        includeAllowances: false,
      });

      // Scenario B: 5% salary raise
      const scenarioB = simulateSalaryAdjustment(currentState, {
        scope: 'ALL',
        adjustmentType: 'PERCENTAGE',
        adjustmentValue: 5,
        effectiveDate: new Date('2024-07-01'),
        includeAllowances: false,
      });

      const comparison = compareScenarios([scenarioA, scenarioB]);

      expect(comparison.scenarios.length).toBe(2);
      // B (5%) should be cheaper than A (10%)
      expect(comparison.cheapestScenario).toBe(scenarioB.scenarioId);
      expect(comparison.mostExpensiveScenario).toBe(scenarioA.scenarioId);
      // Scenarios should be sorted by annual cost ascending
      expect(comparison.scenarios[0].annualCost).toBeLessThanOrEqual(comparison.scenarios[1].annualCost);
      // Recommendation
      expect(comparison.recommendation).toBeTruthy();
    });

    it('should handle empty scenarios array gracefully', () => {
      const comparison = compareScenarios([]);
      expect(comparison.scenarios.length).toBe(0);
      expect(comparison.cheapestScenario).toBe('');
      expect(comparison.mostExpensiveScenario).toBe('');
      expect(comparison.recommendation).toContain('No scenarios');
    });
  });

  // ─── Generate Report (1 test) ───────────────────────────────────────────

  describe('generateSimulationReport', () => {
    it('should produce a 5-section bilingual report with title', () => {
      currentState = refreshState();
      const result = simulateSalaryAdjustment(currentState, {
        scope: 'ALL',
        adjustmentType: 'PERCENTAGE',
        adjustmentValue: 8,
        effectiveDate: new Date('2024-07-01'),
        includeAllowances: false,
      });

      const report = generateSimulationReport(result);

      expect(report.title).toBeTruthy();
      expect(report.sections.length).toBe(5);

      // Verify all 5 section headings
      const headings = report.sections.map(s => s.heading);
      expect(headings).toContain('Executive Summary');
      expect(headings).toContain('Financial Impact');
      expect(headings).toContain('Department Breakdown');
      expect(headings).toContain('Warnings & Considerations');
      expect(headings).toContain('Recommendation');

      // Every section should have heading and content
      for (const section of report.sections) {
        expect(section.heading).toBeTruthy();
        expect(section.content).toBeTruthy();
      }

      // Financial Impact section should mention SAR
      const finSection = report.sections.find(s => s.heading === 'Financial Impact')!;
      expect(finSection.content).toContain('SAR');
    });
  });
});
