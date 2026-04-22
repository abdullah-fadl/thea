import { logger } from '@/lib/monitoring/logger';
/**
 * CVision HR Analytics API
 * GET /api/cvision/analytics - Absence patterns, turnover, payroll trends,
 *   workforce insights, retention risk, executive summary, department comparison
 *
 * Pulls data from existing collections and runs the analytics-engine
 * computations. Read-only — no writes, no mutations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  getCVisionDb,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type {
  CVisionEmployee,
  CVisionContract,
  CVisionPayrollRun,
} from '@/lib/cvision/types';
import {
  analyzeAbsencePatterns,
  analyzeTurnover,
  analyzePayrollTrends,
  generateWorkforceInsights,
  calculateRetentionRisk,
  generateExecutiveSummary,
  type DateRange,
} from '@/lib/cvision/analytics/analytics-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Constants ──────────────────────────────────────────────────────────────

const ATTENDANCE_COLLECTION = 'cvision_attendance';
const VIOLATIONS_COLLECTION = 'cvision_violations';

const RISK_LEVEL_ORDER: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parses an ISO date string; returns null if invalid.
 */
function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Returns a DateRange with configurable defaults.
 * Validates both dates and returns a 400-style error string if either is invalid.
 */
function parseDateRange(
  fromStr: string | null,
  toStr: string | null,
  defaultMonthsBack: number,
): { range: DateRange } | { error: true } {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setMonth(defaultFrom.getMonth() - defaultMonthsBack);

  if (fromStr) {
    const d = parseDate(fromStr);
    if (!d) return { error: true };
  }
  if (toStr) {
    const d = parseDate(toStr);
    if (!d) return { error: true };
  }

  return {
    range: {
      start: fromStr ? new Date(fromStr) : defaultFrom,
      end: toStr ? new Date(toStr) : now,
    },
  };
}

/**
 * Builds employee name from a raw CVisionEmployee document.
 */
function empName(emp: any): string {
  return (
    emp.fullName ||
    `${emp.firstName || ''} ${emp.lastName || ''}`.trim() ||
    emp.id
  );
}

/**
 * Returns a JSON 400 response for invalid date formats (bilingual).
 */
function invalidDateResponse() {
  return NextResponse.json(
    {
      success: false,
      error: 'Invalid date format. Use ISO 8601 (e.g. 2025-01-01)',
    },
    { status: 400 },
  );
}

// ─── GET Handler ────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');

      // Shared DB handles
      const db = await getCVisionDb(tenantId);
      const empCol = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');

      // ── action=absence ───────────────────────────────────────────────
      if (action === 'absence') {
        const parsed = parseDateRange(
          searchParams.get('from'),
          searchParams.get('to'),
          6,
        );
        if ('error' in parsed) return invalidDateResponse();
        const { range } = parsed;

        const department = searchParams.get('department');

        // Fetch employees (ACTIVE + PROBATION) - limit to prevent OOM
        const empFilter: any = {
          status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
        };
        if (department) empFilter.departmentId = department;

        const employees = await empCol
          .find(createTenantFilter(tenantId, empFilter))
          .limit(2000)
          .toArray();

        const employeeIds = employees.map(e => e.id);

        // Fetch attendance within range (limit to prevent OOM)
        const attendanceRecords = await db
          .collection(ATTENDANCE_COLLECTION)
          .find({
            tenantId,
            employeeId: { $in: employeeIds },
            date: { $gte: range.start, $lte: range.end },
          })
          .limit(50000)
          .toArray();

        // Fetch leaves within range (limit to prevent OOM)
        const leavesCol = await getCVisionCollection(tenantId, 'leaves');
        const leaveRecords = await leavesCol
          .find(
            createTenantFilter(tenantId, {
              employeeId: { $in: employeeIds },
              startDate: { $lte: range.end },
              endDate: { $gte: range.start },
            }),
          )
          .limit(10000)
          .toArray();

        const absenceAnalytics = analyzeAbsencePatterns({
          employees: employees.map(e => ({
            id: e.id,
            name: empName(e),
            departmentId: e.departmentId,
          })),
          attendanceRecords: attendanceRecords.map((r) => {
            const doc = r as Record<string, unknown>;
            return {
              employeeId: doc.employeeId as string,
              date: doc.date as string,
              status: doc.status as string,
              lateMinutes: (doc.lateMinutes as number) || 0,
              earlyLeaveMinutes: (doc.earlyLeaveMinutes as number) || 0,
            };
          }),
          leaveRecords: leaveRecords.map((l) => {
            const doc = l as Record<string, unknown>;
            return {
              employeeId: doc.employeeId as string,
              type: (doc.leaveType as string) || (doc.type as string),
              status: doc.status as string,
              startDate: doc.startDate as string,
              endDate: doc.endDate as string,
              totalDays: (doc.days as number) || (doc.totalDays as number) || 0,
            };
          }),
          dateRange: range,
        });

        return NextResponse.json({ success: true, data: absenceAnalytics });
      }

      // ── action=turnover ──────────────────────────────────────────────
      if (action === 'turnover') {
        const parsed = parseDateRange(
          searchParams.get('from'),
          searchParams.get('to'),
          12,
        );
        if ('error' in parsed) return invalidDateResponse();
        const { range } = parsed;

        const department = searchParams.get('department');

        // Fetch ALL employees (including resigned/terminated)
        const empFilter: any = {};
        if (department) empFilter.departmentId = department;

        const employees = await empCol
          .find(createTenantFilter(tenantId, empFilter))
          .limit(5000)
          .toArray();

        const turnoverAnalytics = analyzeTurnover({
          employees: employees.map(e => ({
            id: e.id,
            name: empName(e),
            departmentId: e.departmentId,
            jobTitleId: e.jobTitleId,
            status: e.status,
            hiredAt: e.hiredAt || null,
            resignedAt: e.resignedAt || null,
            terminatedAt: e.terminatedAt || null,
            statusReason: e.statusReason || null,
          })),
          dateRange: range,
        });

        return NextResponse.json({ success: true, data: turnoverAnalytics });
      }

      // ── action=payroll-trends ────────────────────────────────────────
      if (action === 'payroll-trends') {
        const parsed = parseDateRange(
          searchParams.get('from'),
          searchParams.get('to'),
          12,
        );
        if ('error' in parsed) return invalidDateResponse();
        const { range } = parsed;

        // Convert date range to period strings (YYYY-MM)
        const startPeriod = `${range.start.getFullYear()}-${String(range.start.getMonth() + 1).padStart(2, '0')}`;
        const endPeriod = `${range.end.getFullYear()}-${String(range.end.getMonth() + 1).padStart(2, '0')}`;

        const runsCol = await getCVisionCollection<CVisionPayrollRun>(tenantId, 'payrollRuns');
        const payrollRuns = await runsCol
          .find(
            createTenantFilter(tenantId, {
              status: { $in: ['paid', 'approved', 'PAID', 'APPROVED'] as string[] },
              period: { $gte: startPeriod, $lte: endPeriod },
            }),
          )
          .sort({ period: 1 })
          .limit(5000)
          .toArray();

        const payrollTrends = analyzePayrollTrends({
          payrollRuns: payrollRuns.map(r => ({
            period: r.period,
            status: r.status,
            totalsJson: r.totalsJson || {
              totalGross: 0,
              totalNet: 0,
              employeeCount: 0,
            },
          })),
          dateRange: range,
        });

        return NextResponse.json({ success: true, data: payrollTrends });
      }

      // ── action=workforce ─────────────────────────────────────────────
      if (action === 'workforce') {
        const employees = await empCol
          .find(createTenantFilter(tenantId, {}))
          .limit(5000)
          .toArray();

        // Fetch department names for UUID → name resolution
        const deptCol = await getCVisionCollection(tenantId, 'departments');
        const departments = await deptCol.find(createTenantFilter(tenantId)).limit(500).toArray();
        const deptNameMap: Record<string, string> = {};
        for (const d of departments) {
          deptNameMap[d.id] = d.name || d.id;
        }

        // Fetch PERSONAL profile sections for demographic fallback
        // (employees created via UI may have demographics only in profile sections, not root)
        const personalSectionsCol = await getCVisionCollection(tenantId, 'employeeProfileSections');
        const personalSections = await personalSectionsCol.find(
          createTenantFilter(tenantId, { sectionKey: 'PERSONAL' })
        ).limit(5000).toArray();
        const personalDataMap: Record<string, any> = {};
        for (const section of personalSections) {
          personalDataMap[(section as Record<string, unknown>).employeeId as string] = ((section as Record<string, unknown>).dataJson || {}) as Record<string, unknown>;
        }

        // Fetch active contracts
        const contractsCol = await getCVisionCollection<CVisionContract>(tenantId, 'contracts');
        const contracts = await contractsCol
          .find(
            createTenantFilter(tenantId, {
              status: { $in: ['ACTIVE', 'active'] as string[] },
            }),
          )
          .limit(5000)
          .toArray();

        const workforceInsights = generateWorkforceInsights({
          employees: employees.map(e => {
            const pd = personalDataMap[e.id] || {};
            return {
              id: e.id,
              departmentId: e.departmentId,
              nationality: e.nationality || pd.nationality || null,
              gender: e.gender || pd.gender || null,
              dateOfBirth: e.dateOfBirth || (pd.dob ? new Date(pd.dob) : null),
              status: e.status,
              hiredAt: e.hiredAt || null,
              contractEndDate: e.contractEndDate || null,
              probationEndDate: e.probationEndDate || null,
            };
          }),
          contracts: contracts.map(c => ({
            employeeId: c.employeeId,
            type: c.type,
            status: c.status,
            endDate: c.endDate || null,
          })),
        });

        // Resolve department UUID keys to human-readable names
        if (workforceInsights.byDepartment) {
          const resolvedByDepartment: Record<string, number> = {};
          for (const [deptId, count] of Object.entries(workforceInsights.byDepartment)) {
            resolvedByDepartment[deptNameMap[deptId] || deptId] = count as number;
          }
          workforceInsights.byDepartment = resolvedByDepartment;
        }

        return NextResponse.json({
          success: true,
          data: { ...workforceInsights, departmentNames: deptNameMap },
        });
      }

      // ── action=retention-risk ────────────────────────────────────────
      if (action === 'retention-risk') {
        const department = searchParams.get('department');
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
        const minRisk = (searchParams.get('minRisk') || 'MEDIUM').toUpperCase();

        // Minimum risk level threshold
        const minRiskOrder = RISK_LEVEL_ORDER[minRisk] || RISK_LEVEL_ORDER.MEDIUM;

        // Fetch department names for UUID → name resolution
        const deptCol = await getCVisionCollection(tenantId, 'departments');
        const deptDocs = await deptCol.find(createTenantFilter(tenantId)).limit(500).toArray();
        const deptNameMap: Record<string, string> = {};
        for (const d of deptDocs) {
          deptNameMap[d.id] = d.name || d.id;
        }

        // Fetch active employees (limit to prevent OOM)
        const empFilter: any = {
          status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
        };
        if (department) empFilter.departmentId = department;

        const employees = await empCol
          .find(createTenantFilter(tenantId, empFilter))
          .limit(2000)
          .toArray();

        const employeeIds = employees.map(e => e.id);

        // Fetch attendance (last 6 months for risk scoring) - limit to prevent OOM
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const attendanceRecords = await db
          .collection(ATTENDANCE_COLLECTION)
          .find({
            tenantId,
            employeeId: { $in: employeeIds },
            date: { $gte: sixMonthsAgo },
          })
          .limit(50000)
          .toArray();

        // Fetch leaves (last 12 months) - limit to prevent OOM
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const leavesCol = await getCVisionCollection(tenantId, 'leaves');
        const leaveRecords = await leavesCol
          .find(
            createTenantFilter(tenantId, {
              employeeId: { $in: employeeIds },
              status: { $in: ['APPROVED'] },
              startDate: { $gte: twelveMonthsAgo },
            }),
          )
          .limit(10000)
          .toArray();

        // Fetch recent violations (last 6 months) - limit to prevent OOM
        const violations = await db
          .collection(VIOLATIONS_COLLECTION)
          .find({
            tenantId,
            employeeId: { $in: employeeIds },
            createdAt: { $gte: sixMonthsAgo },
          })
          .limit(5000)
          .toArray();

        // Group by employee
        const attendanceByEmp: Record<string, any[]> = {};
        for (const r of attendanceRecords) {
          const eid = (r as Record<string, unknown>).employeeId as string;
          if (!attendanceByEmp[eid]) attendanceByEmp[eid] = [];
          attendanceByEmp[eid].push(r);
        }

        const leavesByEmp: Record<string, any[]> = {};
        for (const l of leaveRecords) {
          const eid = (l as Record<string, unknown>).employeeId as string;
          if (!leavesByEmp[eid]) leavesByEmp[eid] = [];
          leavesByEmp[eid].push(l);
        }

        const violationsByEmp: Record<string, any[]> = {};
        for (const v of violations) {
          const eid = (v as Record<string, unknown>).employeeId as string;
          if (!violationsByEmp[eid]) violationsByEmp[eid] = [];
          violationsByEmp[eid].push(v);
        }

        // Calculate risk for each employee
        const riskResults: {
          employeeId: string;
          employeeName: string;
          departmentId: string;
          departmentName: string;
          riskScore: number;
          riskLevel: string;
          factors: { name: string; score: number; severity: string }[];
          recommendation: string;
        }[] = [];

        let highRisk = 0;
        let mediumRisk = 0;
        let lowRisk = 0;
        let criticalRisk = 0;

        for (const emp of employees) {
          const empAttendance = (attendanceByEmp[emp.id] || []).map((r) => ({
            status: r.status as string,
            lateMinutes: (r.lateMinutes as number) || 0,
          }));

          const empLeaves = (leavesByEmp[emp.id] || []).map((l) => ({
            type: (l.leaveType as string) || (l.type as string),
            totalDays: (l.days as number) || (l.totalDays as number) || 0,
          }));

          const empViolations = (violationsByEmp[emp.id] || []).map((v) => ({
            type: (v.type as string) || (v.violationType as string) || '',
            severity: (v.severity as string) || '',
          }));

          const risk = calculateRetentionRisk({
            employee: {
              id: emp.id,
              name: empName(emp),
              departmentId: emp.departmentId,
              hiredAt: emp.hiredAt || null,
              status: emp.status,
              contractEndDate: emp.contractEndDate || null,
              probationEndDate: emp.probationEndDate || null,
            },
            attendanceRecords: empAttendance,
            leaveRecords: empLeaves,
            recentViolations: empViolations,
          });

          // Count by level
          if (risk.riskLevel === 'CRITICAL') criticalRisk++;
          else if (risk.riskLevel === 'HIGH') highRisk++;
          else if (risk.riskLevel === 'MEDIUM') mediumRisk++;
          else lowRisk++;

          // Apply minRisk filter
          const riskOrder = RISK_LEVEL_ORDER[risk.riskLevel] || 1;
          if (riskOrder >= minRiskOrder) {
            riskResults.push({
              employeeId: emp.id,
              employeeName: empName(emp),
              departmentId: emp.departmentId,
              departmentName: deptNameMap[emp.departmentId] || emp.departmentId,
              riskScore: risk.riskScore,
              riskLevel: risk.riskLevel,
              factors: risk.factors as any,
              recommendation: risk.recommendation,
            });
          }
        }

        // Sort by riskScore descending, limit
        riskResults.sort((a, b) => b.riskScore - a.riskScore);
        const limited = riskResults.slice(0, limit);

        return NextResponse.json({
          success: true,
          data: {
            employees: limited,
            totalAssessed: employees.length,
            criticalRisk,
            highRisk,
            mediumRisk,
            lowRisk,
          },
        });
      }

      // ── action=executive-summary ─────────────────────────────────────
      if (action === 'executive-summary') {
        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const absenceRange: DateRange = { start: sixMonthsAgo, end: now };
        const turnoverRange: DateRange = { start: twelveMonthsAgo, end: now };
        const payrollRange: DateRange = { start: twelveMonthsAgo, end: now };

        // ── Fetch all data ──────────────────────────────────────────────

        // All employees (limit to prevent OOM)
        const allEmployees = await empCol
          .find(createTenantFilter(tenantId, {}))
          .limit(5000)
          .toArray();

        // Fetch PERSONAL profile sections for demographic fallback (limit to prevent OOM)
        const esPersonalSectionsCol = await getCVisionCollection(tenantId, 'employeeProfileSections');
        const esPersonalSections = await esPersonalSectionsCol.find(
          createTenantFilter(tenantId, { sectionKey: 'PERSONAL' })
        ).limit(5000).toArray();
        const esPersonalDataMap: Record<string, any> = {};
        for (const section of esPersonalSections) {
          esPersonalDataMap[(section as Record<string, unknown>).employeeId as string] = ((section as Record<string, unknown>).dataJson || {}) as Record<string, unknown>;
        }

        // Active employees
        const activeEmployees = allEmployees.filter(e => {
          const s = e.status?.toUpperCase();
          return s === 'ACTIVE' || s === 'PROBATION';
        });

        const activeIds = activeEmployees.map(e => e.id);

        // Attendance (6 months) - limit to prevent OOM
        const attendanceRecords = await db
          .collection(ATTENDANCE_COLLECTION)
          .find({
            tenantId,
            employeeId: { $in: activeIds },
            date: { $gte: sixMonthsAgo, $lte: now },
          })
          .limit(50000)
          .toArray();

        // Leaves (6 months) - limit to prevent OOM
        const leavesCol = await getCVisionCollection(tenantId, 'leaves');
        const leaveRecords = await leavesCol
          .find(
            createTenantFilter(tenantId, {
              employeeId: { $in: activeIds },
              startDate: { $lte: now },
              endDate: { $gte: sixMonthsAgo },
            }),
          )
          .limit(10000)
          .toArray();

        // Payroll runs (12 months)
        const startPeriod = `${turnoverRange.start.getFullYear()}-${String(turnoverRange.start.getMonth() + 1).padStart(2, '0')}`;
        const endPeriod = `${turnoverRange.end.getFullYear()}-${String(turnoverRange.end.getMonth() + 1).padStart(2, '0')}`;

        const runsCol = await getCVisionCollection<CVisionPayrollRun>(tenantId, 'payrollRuns');
        const payrollRuns = await runsCol
          .find(
            createTenantFilter(tenantId, {
              status: { $in: ['paid', 'approved', 'PAID', 'APPROVED'] as string[] },
              period: { $gte: startPeriod, $lte: endPeriod },
            }),
          )
          .sort({ period: 1 })
          .limit(5000)
          .toArray();

        // Contracts
        const contractsCol = await getCVisionCollection<CVisionContract>(tenantId, 'contracts');
        const contracts = await contractsCol
          .find(
            createTenantFilter(tenantId, {
              status: { $in: ['ACTIVE', 'active'] as string[] },
            }),
          )
          .limit(5000)
          .toArray();

        // ── Run all 4 analytics ─────────────────────────────────────────

        const absenceAnalytics = analyzeAbsencePatterns({
          employees: activeEmployees.map(e => ({
            id: e.id,
            name: empName(e),
            departmentId: e.departmentId,
          })),
          attendanceRecords: attendanceRecords.map((r) => {
            const doc = r as Record<string, unknown>;
            return {
              employeeId: doc.employeeId as string,
              date: doc.date as string,
              status: doc.status as string,
              lateMinutes: (doc.lateMinutes as number) || 0,
              earlyLeaveMinutes: (doc.earlyLeaveMinutes as number) || 0,
            };
          }),
          leaveRecords: leaveRecords.map((l) => {
            const doc = l as Record<string, unknown>;
            return {
              employeeId: doc.employeeId as string,
              type: (doc.leaveType as string) || (doc.type as string),
              status: doc.status as string,
              startDate: doc.startDate as string,
              endDate: doc.endDate as string,
              totalDays: (doc.days as number) || (doc.totalDays as number) || 0,
            };
          }),
          dateRange: absenceRange,
        });

        const turnoverAnalytics = analyzeTurnover({
          employees: allEmployees.map(e => ({
            id: e.id,
            name: empName(e),
            departmentId: e.departmentId,
            jobTitleId: e.jobTitleId,
            status: e.status,
            hiredAt: e.hiredAt || null,
            resignedAt: e.resignedAt || null,
            terminatedAt: e.terminatedAt || null,
            statusReason: e.statusReason || null,
          })),
          dateRange: turnoverRange,
        });

        const payrollTrends = analyzePayrollTrends({
          payrollRuns: payrollRuns.map(r => ({
            period: r.period,
            status: r.status,
            totalsJson: r.totalsJson || {
              totalGross: 0,
              totalNet: 0,
              employeeCount: 0,
            },
          })),
          dateRange: payrollRange,
        });

        const workforceInsights = generateWorkforceInsights({
          employees: allEmployees.map(e => {
            const pd = esPersonalDataMap[e.id] || {};
            return {
              id: e.id,
              departmentId: e.departmentId,
              nationality: e.nationality || pd.nationality || null,
              gender: e.gender || pd.gender || null,
              dateOfBirth: e.dateOfBirth || (pd.dob ? new Date(pd.dob) : null),
              status: e.status,
              hiredAt: e.hiredAt || null,
              contractEndDate: e.contractEndDate || null,
              probationEndDate: e.probationEndDate || null,
            };
          }),
          contracts: contracts.map(c => ({
            employeeId: c.employeeId,
            type: c.type,
            status: c.status,
            endDate: c.endDate || null,
          })),
        });

        // ── Generate summary ────────────────────────────────────────────

        const executiveSummary = generateExecutiveSummary({
          absenceAnalytics,
          turnoverAnalytics,
          payrollTrends,
          workforceInsights,
        });

        // Latest payroll for quick metrics
        const latestPayroll = payrollTrends.length > 0
          ? payrollTrends[payrollTrends.length - 1]
          : null;

        return NextResponse.json({
          success: true,
          data: {
            summary: executiveSummary,
            metrics: {
              absenceRate: absenceAnalytics.overallAbsenteeismRate,
              turnoverRate: turnoverAnalytics.turnoverRate,
              saudizationRate: workforceInsights.saudizationRate,
              monthlyPayrollTotal: latestPayroll?.totalGross || 0,
              headcount: workforceInsights.totalHeadcount,
            },
          },
        });
      }

      // ── action=department-comparison ──────────────────────────────────
      if (action === 'department-comparison') {
        const sortBy = searchParams.get('sortBy') || 'headcount';

        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        // Fetch all employees (limit to prevent OOM)
        const allEmployees = await empCol
          .find(createTenantFilter(tenantId, {}))
          .limit(5000)
          .toArray();

        // Active employees for absence calculation
        const activeEmployees = allEmployees.filter(e => {
          const s = e.status?.toUpperCase();
          return s === 'ACTIVE' || s === 'PROBATION';
        });

        const activeIds = activeEmployees.map(e => e.id);

        // Attendance (6 months) - limit to prevent OOM
        const attendanceRecords = await db
          .collection(ATTENDANCE_COLLECTION)
          .find({
            tenantId,
            employeeId: { $in: activeIds },
            date: { $gte: sixMonthsAgo, $lte: now },
          })
          .limit(50000)
          .toArray();

        // Fetch latest payroll run for salary data
        const runsCol = await getCVisionCollection<CVisionPayrollRun>(tenantId, 'payrollRuns');
        const latestRun = await runsCol
          .find(
            createTenantFilter(tenantId, {
              status: { $in: ['paid', 'approved', 'PAID', 'APPROVED'] as string[] },
            }),
          )
          .sort({ period: -1 })
          .limit(1)
          .toArray();

        // Fetch payslips for the latest run to get per-employee salary
        let payslipsByDept: Record<string, { totalGross: number; count: number }> = {};
        if (latestRun.length > 0) {
          const payslipsCol = await getCVisionCollection(tenantId, 'payslips');
          const payslips = await payslipsCol
            .find(createTenantFilter(tenantId, { runId: latestRun[0].id }))
            .limit(5000)
            .toArray();

          // Map employee → department for aggregation
          const empDeptMap: Record<string, string> = {};
          for (const emp of activeEmployees) {
            empDeptMap[emp.id] = emp.departmentId;
          }

          for (const ps of payslips) {
            const psDoc = ps as Record<string, unknown>;
            const dept = empDeptMap[psDoc.employeeId as string];
            if (!dept) continue;
            if (!payslipsByDept[dept]) payslipsByDept[dept] = { totalGross: 0, count: 0 };
            payslipsByDept[dept].totalGross += (psDoc.gross as number) || 0;
            payslipsByDept[dept].count++;
          }
        }

        // Group by department
        const departments = new Set<string>();
        for (const emp of allEmployees) departments.add(emp.departmentId);

        // Attendance grouped by department
        const attendanceByDept: Record<string, { total: number; absent: number }> = {};
        for (const r of attendanceRecords) {
          const rec = r as Record<string, unknown>;
          // Find department from employee
          const emp = activeEmployees.find(e => e.id === rec.employeeId);
          if (!emp) continue;
          const dept = emp.departmentId;
          if (!attendanceByDept[dept]) attendanceByDept[dept] = { total: 0, absent: 0 };
          attendanceByDept[dept].total++;
          if ((rec as any).status?.toUpperCase() === 'ABSENT') attendanceByDept[dept].absent++;
        }

        // Turnover by department
        const turnoverByDept: Record<string, { separations: number; activeCount: number }> = {};
        for (const emp of allEmployees) {
          const dept = emp.departmentId;
          if (!turnoverByDept[dept]) turnoverByDept[dept] = { separations: 0, activeCount: 0 };

          const s = emp.status?.toUpperCase();
          if (s === 'ACTIVE' || s === 'PROBATION') {
            turnoverByDept[dept].activeCount++;
          }

          // Count separations in the last 12 months
          if (s === 'RESIGNED' && emp.resignedAt) {
            const d = new Date(emp.resignedAt);
            if (d >= twelveMonthsAgo && d <= now) turnoverByDept[dept].separations++;
          }
          if (s === 'TERMINATED' && emp.terminatedAt) {
            const d = new Date(emp.terminatedAt);
            if (d >= twelveMonthsAgo && d <= now) turnoverByDept[dept].separations++;
          }
        }

        // Build comparison array
        const comparisons = Array.from(departments).map(dept => {
          const active = allEmployees.filter(
            e => e.departmentId === dept && ['ACTIVE', 'PROBATION'].includes(e.status?.toUpperCase()),
          );
          const headcount = active.length;

          const payData = payslipsByDept[dept];
          const avgSalary = payData && payData.count > 0
            ? Math.round((payData.totalGross / payData.count) * 100) / 100
            : 0;

          const attData = attendanceByDept[dept];
          const absenceRate = attData && attData.total > 0
            ? Math.round((attData.absent / attData.total) * 100 * 100) / 100
            : 0;

          const toData = turnoverByDept[dept];
          const turnoverRate = toData && toData.activeCount > 0
            ? Math.round((toData.separations / toData.activeCount) * 100 * 100) / 100
            : 0;

          return {
            department: dept,
            headcount,
            avgSalary,
            absenceRate,
            turnoverRate,
          };
        });

        // Sort
        const validSortFields = ['headcount', 'avgSalary', 'absenceRate', 'turnoverRate'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'headcount';

        comparisons.sort((a, b) => {
          const aVal = (a as Record<string, unknown>)[sortField] as number || 0;
          const bVal = (b as Record<string, unknown>)[sortField] as number || 0;
          return bVal - aVal; // descending
        });

        return NextResponse.json({
          success: true,
          data: { departments: comparisons },
        });
      }

      // ── Default: API docs ────────────────────────────────────────────
      return NextResponse.json({
        success: true,
        data: {
          description: 'CVision HR Analytics API',
          actions: {
            'absence': {
              method: 'GET',
              description: 'Absence pattern analytics',
              params: { from: 'ISO date (default: 6 months ago)', to: 'ISO date (default: now)', department: 'optional department filter' },
            },
            'turnover': {
              method: 'GET',
              description: 'Employee turnover analytics',
              params: { from: 'ISO date (default: 12 months ago)', to: 'ISO date (default: now)', department: 'optional department filter' },
            },
            'payroll-trends': {
              method: 'GET',
              description: 'Payroll cost trends over time',
              params: { from: 'ISO date (default: 12 months ago)', to: 'ISO date (default: now)' },
            },
            'workforce': {
              method: 'GET',
              description: 'Workforce demographics and insights',
              params: {},
            },
            'retention-risk': {
              method: 'GET',
              description: 'Employee retention risk assessment',
              params: { department: 'optional', limit: 'number (default: 20)', minRisk: 'HIGH | MEDIUM | LOW (default: MEDIUM)' },
            },
            'executive-summary': {
              method: 'GET',
              description: 'Combined executive summary with all analytics',
              params: {},
            },
            'department-comparison': {
              method: 'GET',
              description: 'Compare departments by key metrics',
              params: { sortBy: 'headcount | avgSalary | absenceRate | turnoverRate (default: headcount)' },
            },
          },
        },
      });
    } catch (error) {
      logger.error('[Analytics API]', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 },
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ },
);
