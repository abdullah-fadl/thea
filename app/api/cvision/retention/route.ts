import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Retention AI API
 *
 * GET  actions: dashboard, employees, employee-detail, department-stats,
 *               alerts, risk-factors, cost-analysis
 * POST actions: calculate, calculate-employee, generate-alerts,
 *               acknowledge-alert, action-taken, resolve-alert, dismiss-alert
 *
 * Auto-seeds scores on first GET if cvision_retention_scores is empty.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSessionAndTenant, middlewareError } from '@/lib/cvision/middleware';
import { getCVisionDb, getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import type { Db, Document, Filter } from 'mongodb';
import {
  calculateEmployeeRisk,
  calculateAllRisks,
  getDepartmentStats,
  getOrganizationRiskSummary,
  buildRetentionAlerts,
  type EmployeeInput,
  type SalaryChangeRecord,
  type PerformanceReviewRecord,
  type LeaveRecord,
  type PromotionRecord,
  type DisciplinaryRecord,
  type AttendanceRecord,
  type HistoricalScore,
  type RetentionRiskProfile,
  type RetentionAlert,
} from '@/lib/cvision/retention/retention-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SCORES_COLL = 'cvision_retention_scores';
const ALERTS_COLL = 'cvision_retention_alerts';
const ATTENDANCE_COLL = 'cvision_attendance';

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) return middlewareError(authResult);

    const { tenantId, userId } = authResult.data;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'dashboard';

    const db = await getCVisionDb(tenantId) as unknown as Db;

    // Auto-seed: if no scores exist yet, run a full calculation
    await ensureScoresExist(db, tenantId);

    // ── Dashboard ─────────────────────────────────────────────────
    if (action === 'dashboard') {
      const latest = await getLatestProfiles(db, tenantId);
      const avgSalary = await getAvgSalary(db, tenantId);
      const summary = getOrganizationRiskSummary(latest, avgSalary);

      // Trend: compare avg score vs previous batch
      const previousBatch = await getPreviousBatchAvg(db, tenantId);
      const trendDelta = previousBatch != null
        ? Math.round((summary.avgRiskScore - previousBatch) * 10) / 10
        : null;

      const alertCounts = await db.collection(ALERTS_COLL).aggregate([
        { $match: { tenantId, status: { $in: ['NEW', 'ACKNOWLEDGED'] } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).toArray();
      const activeAlerts = {
        new: (alertCounts.find((a) => a._id === 'NEW') as Record<string, number> | undefined)?.count || 0,
        acknowledged: (alertCounts.find((a) => a._id === 'ACKNOWLEDGED') as Record<string, number> | undefined)?.count || 0,
      };

      return NextResponse.json({
        success: true,
        data: {
          ...summary,
          trend: trendDelta != null
            ? { delta: trendDelta, direction: trendDelta > 0 ? 'WORSENING' : trendDelta < 0 ? 'IMPROVING' : 'STABLE' }
            : null,
          activeAlerts,
        },
      });
    }

    // ── Employee list ─────────────────────────────────────────────
    if (action === 'employees') {
      const department = searchParams.get('department');
      const riskLevel = searchParams.get('riskLevel')?.toUpperCase();
      const minScore = parseInt(searchParams.get('minScore') || '0', 10);
      const maxScore = parseInt(searchParams.get('maxScore') || '100', 10);
      const limit = Math.min(200, parseInt(searchParams.get('limit') || '50', 10));
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
      const sortField = searchParams.get('sort') || 'flightRiskScore';
      const sortDir = searchParams.get('dir') === 'asc' ? 1 : -1;

      // Get latest per employee first
      const latest = await getLatestProfiles(db, tenantId);

      let filtered = latest;
      if (department) filtered = filtered.filter(p => p.departmentId === department);
      if (riskLevel) filtered = filtered.filter(p => p.riskLevel === riskLevel);
      filtered = filtered.filter(p => p.flightRiskScore >= minScore && p.flightRiskScore <= maxScore);

      filtered.sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[sortField] ?? 0;
        const bv = (b as unknown as Record<string, unknown>)[sortField] ?? 0;
        return sortDir * ((bv as number) > (av as number) ? 1 : (bv as number) < (av as number) ? -1 : 0);
      });

      const total = filtered.length;
      const paged = filtered.slice((page - 1) * limit, page * limit);

      return NextResponse.json({
        success: true,
        data: paged,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    }

    // ── Employee detail (fresh calculation) ───────────────────────
    if (action === 'employee-detail') {
      const employeeId = searchParams.get('employeeId');
      if (!employeeId) {
        return NextResponse.json({ success: false, error: 'employeeId required' }, { status: 400 });
      }

      const empCol = await getCVisionCollection(tenantId, 'employees');
      const emp = await empCol.findOne(createTenantFilter(tenantId, { id: employeeId } as Filter<Document>));
      if (!emp) {
        return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
      }

      const data = await fetchAllRetentionData(db, tenantId, [emp]);
      const profile = calculateEmployeeRisk({
        employee: toEmployeeInput(emp, data.deptNames, data.jtNames),
        salaryChanges: data.salaryChanges.filter(s => s.employeeId === employeeId),
        performanceReviews: data.perfReviews.filter(p => p.employeeId === employeeId),
        leaves: data.leaves.filter(l => l.employeeId === employeeId),
        promotions: data.promotions.filter(p => p.employeeId === employeeId),
        disciplinary: data.disciplinary.filter(d => d.employeeId === employeeId),
        attendance: data.attendance.filter(a => a.employeeId === employeeId),
        departmentSize: data.deptSizes[emp.departmentId] || 5,
        previousScore: data.previousScores.find(s => s.employeeId === employeeId)?.flightRiskScore,
      });

      // Historical trend (last 3)
      const history = await db.collection(SCORES_COLL)
        .find({ tenantId, employeeId })
        .sort({ calculatedAt: -1 })
        .limit(3)
        .project({ flightRiskScore: 1, riskLevel: 1, calculatedAt: 1, _id: 0 })
        .toArray();

      return NextResponse.json({
        success: true,
        data: { profile, history },
      });
    }

    // ── Department stats ──────────────────────────────────────────
    if (action === 'department-stats') {
      const latest = await getLatestProfiles(db, tenantId);
      const stats = getDepartmentStats(latest);

      return NextResponse.json({ success: true, data: stats });
    }

    // ── Alerts ────────────────────────────────────────────────────
    if (action === 'alerts') {
      const status = searchParams.get('status')?.toUpperCase();
      const department = searchParams.get('department');

      const filter: any = { tenantId };
      if (status) {
        filter.status = status;
      } else {
        filter.status = { $in: ['NEW', 'ACKNOWLEDGED'] };
      }
      if (department) filter.departmentId = department;

      const alerts = await db.collection(ALERTS_COLL)
        .find(filter)
        .sort({ riskScore: -1, createdAt: -1 })
        .limit(200)
        .toArray();

      return NextResponse.json({ success: true, data: alerts });
    }

    // ── Risk factors (org-wide aggregate) ─────────────────────────
    if (action === 'risk-factors') {
      const latest = await getLatestProfiles(db, tenantId);

      const factorTotals = new Map<string, {
        name: string; category: string;
        totalScore: number; totalWeighted: number; count: number;
        highCount: number;
      }>();

      for (const p of latest) {
        for (const f of p.factors) {
          const e = factorTotals.get(f.id) || {
            name: f.name, category: f.category,
            totalScore: 0, totalWeighted: 0, count: 0, highCount: 0,
          };
          e.totalScore += f.score;
          e.totalWeighted += f.weightedScore;
          e.count++;
          if (f.severity === 'HIGH') e.highCount++;
          factorTotals.set(f.id, e);
        }
      }

      const ranked = Array.from(factorTotals.values())
        .map(f => ({
          name: f.name,
          category: f.category,
          avgScore: f.count > 0 ? Math.round(f.totalScore / f.count * 10) / 10 : 0,
          avgWeightedScore: f.count > 0 ? Math.round(f.totalWeighted / f.count * 10) / 10 : 0,
          highSeverityCount: f.highCount,
          employeesAffected: f.count,
        }))
        .sort((a, b) => b.avgWeightedScore - a.avgWeightedScore);

      return NextResponse.json({ success: true, data: ranked });
    }

    // ── Cost analysis ─────────────────────────────────────────────
    if (action === 'cost-analysis') {
      const latest = await getLatestProfiles(db, tenantId);
      const avgSalary = await getAvgSalary(db, tenantId);

      // Per-risk-level cost estimate
      // Probability of leaving: CRITICAL 70%, HIGH 30%, MODERATE 5%, LOW 1%
      const LEAVE_PROB: Record<string, number> = { CRITICAL: 0.70, HIGH: 0.30, MODERATE: 0.05, LOW: 0.01 };
      // Replacement cost multiplier: recruitment ~3mo, lost productivity ~2mo, training ~1mo = 6mo total
      const COST_MONTHS = 6;

      const byLevel: Record<string, { count: number; expectedLeavers: number; cost: number }> = {};
      const byDept: Record<string, { dept: string; count: number; expectedLeavers: number; cost: number }> = {};

      let totalExpectedLeavers = 0;
      let totalCost = 0;

      for (const p of latest) {
        const prob = LEAVE_PROB[p.riskLevel] || 0.01;
        const empSalary = (p.factors.find(f => f.id === 'salary_stagnation')?.dataPoints?.currentSalary) || avgSalary;
        const leaveCost = empSalary * COST_MONTHS * prob;

        // By level
        const lvl = byLevel[p.riskLevel] || { count: 0, expectedLeavers: 0, cost: 0 };
        lvl.count++;
        lvl.expectedLeavers += prob;
        lvl.cost += leaveCost;
        byLevel[p.riskLevel] = lvl;

        // By department
        const dKey = p.departmentId || 'unknown';
        const dept = byDept[dKey] || { dept: p.department, count: 0, expectedLeavers: 0, cost: 0 };
        dept.count++;
        dept.expectedLeavers += prob;
        dept.cost += leaveCost;
        byDept[dKey] = dept;

        totalExpectedLeavers += prob;
        totalCost += leaveCost;
      }

      // Round for display
      const levelBreakdown = Object.entries(byLevel).map(([level, d]) => ({
        level,
        employees: d.count,
        expectedLeavers: Math.round(d.expectedLeavers * 10) / 10,
        estimatedCost: Math.round(d.cost),
      })).sort((a, b) => b.estimatedCost - a.estimatedCost);

      const deptBreakdown = Object.values(byDept).map(d => ({
        department: d.dept,
        employees: d.count,
        expectedLeavers: Math.round(d.expectedLeavers * 10) / 10,
        estimatedCost: Math.round(d.cost),
      })).sort((a, b) => b.estimatedCost - a.estimatedCost).slice(0, 10);

      return NextResponse.json({
        success: true,
        data: {
          totalEmployees: latest.length,
          totalExpectedLeavers: Math.round(totalExpectedLeavers * 10) / 10,
          totalEstimatedCost: Math.round(totalCost),
          avgReplacementCost: Math.round(avgSalary * COST_MONTHS),
          costBreakdown: {
            recruitment: Math.round(avgSalary * 3),
            lostProductivity: Math.round(avgSalary * 2),
            trainingNewHire: Math.round(avgSalary * 1),
          },
          byRiskLevel: levelBreakdown,
          byDepartment: deptBreakdown,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    logger.error('Retention API GET error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) return middlewareError(authResult);

    const { tenantId, userId } = authResult.data;
    const body = await request.json();
    const { action } = body;
    const db = await getCVisionDb(tenantId) as unknown as Db;

    // ── Calculate all employees ───────────────────────────────────
    if (action === 'calculate') {
      const result = await runFullCalculation(db, tenantId);
      return NextResponse.json({ success: true, data: result });
    }

    // ── Calculate single employee ─────────────────────────────────
    if (action === 'calculate-employee') {
      const { employeeId } = body;
      if (!employeeId) {
        return NextResponse.json({ success: false, error: 'employeeId required' }, { status: 400 });
      }

      const empCol = await getCVisionCollection(tenantId, 'employees');
      const emp = await empCol.findOne(createTenantFilter(tenantId, { id: employeeId } as Filter<Document>));
      if (!emp) {
        return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
      }

      const data = await fetchAllRetentionData(db, tenantId, [emp]);
      const profile = calculateEmployeeRisk({
        employee: toEmployeeInput(emp, data.deptNames, data.jtNames),
        salaryChanges: data.salaryChanges.filter(s => s.employeeId === employeeId),
        performanceReviews: data.perfReviews.filter(p => p.employeeId === employeeId),
        leaves: data.leaves.filter(l => l.employeeId === employeeId),
        promotions: data.promotions.filter(p => p.employeeId === employeeId),
        disciplinary: data.disciplinary.filter(d => d.employeeId === employeeId),
        attendance: data.attendance.filter(a => a.employeeId === employeeId),
        departmentSize: data.deptSizes[emp.departmentId] || 5,
        previousScore: data.previousScores.find(s => s.employeeId === employeeId)?.flightRiskScore,
      });

      await db.collection(SCORES_COLL).insertOne({ tenantId, ...profile });

      return NextResponse.json({ success: true, data: profile });
    }

    // ── Generate alerts ───────────────────────────────────────────
    if (action === 'generate-alerts') {
      const latest = await getLatestProfiles(db, tenantId);

      // Find manager info for each high-risk employee
      const empCol = await getCVisionCollection(tenantId, 'employees');
      const highRisk = latest.filter(p => p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL');
      const empDocs = await empCol
        .find(createTenantFilter(tenantId, { id: { $in: highRisk.map(p => p.employeeId) }, deletedAt: null } as Filter<Document>))
        .limit(5000)
        .toArray();
      const empMap = new Map<string, any>(empDocs.map((e) => [((e as Record<string, unknown>)).id as string, (e as Record<string, unknown>)]));

      // Attach manager info to profiles
      for (const p of highRisk) {
        const e = empMap.get(p.employeeId);
        if (e?.managerId) {
          ((p as unknown as Record<string, unknown>))._managerId = e.managerId;
          ((p as unknown as Record<string, unknown>))._managerName = e.managerName;
        }
      }

      // Don't duplicate existing unresolved alerts
      const existingAlerts = await db.collection(ALERTS_COLL)
        .find({ tenantId, status: { $in: ['NEW', 'ACKNOWLEDGED'] } })
        .project({ employeeId: 1 })
        .limit(5000)
        .toArray();
      const existingIds = new Set<string>(existingAlerts.map((a) => ((a as Record<string, unknown>)).employeeId as string));

      const now = new Date().toISOString();
      const newAlerts: RetentionAlert[] = [];

      for (const p of highRisk) {
        if (existingIds.has(p.employeeId)) continue;

        newAlerts.push({
          tenantId,
          id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          employeeId: p.employeeId,
          employeeName: p.employeeName,
          department: p.department,
          departmentId: p.departmentId,
          managerId: ((p as unknown as Record<string, unknown>))._managerId as string | undefined,
          managerName: ((p as unknown as Record<string, unknown>))._managerName as string | undefined,
          riskScore: p.flightRiskScore,
          riskLevel: p.riskLevel,
          topFactors: p.factors
            .sort((a, b) => b.weightedScore - a.weightedScore)
            .slice(0, 3)
            .map(f => ({ name: f.name, score: f.weightedScore })),
          recommendations: p.recommendations.map(r => r.action),
          status: 'NEW',
          createdAt: now,
          updatedAt: now,
        });
      }

      if (newAlerts.length > 0) {
        await db.collection(ALERTS_COLL).insertMany(newAlerts);
      }

      const totalActive = await db.collection(ALERTS_COLL)
        .countDocuments({ tenantId, status: { $in: ['NEW', 'ACKNOWLEDGED'] } });

      return NextResponse.json({
        success: true,
        data: { newAlerts: newAlerts.length, totalActive },
      });
    }

    // ── Acknowledge alert ─────────────────────────────────────────
    if (action === 'acknowledge-alert') {
      const { alertId } = body;
      if (!alertId) return NextResponse.json({ success: false, error: 'alertId required' }, { status: 400 });

      const result = await db.collection(ALERTS_COLL).findOneAndUpdate(
        { tenantId, id: alertId },
        { $set: { status: 'ACKNOWLEDGED', acknowledgedBy: userId, acknowledgedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' },
      );

      return NextResponse.json({ success: true, data: result });
    }

    // ── Action taken ──────────────────────────────────────────────
    if (action === 'action-taken') {
      const { alertId, actionTaken } = body;
      if (!alertId || !actionTaken) {
        return NextResponse.json({ success: false, error: 'alertId and actionTaken required' }, { status: 400 });
      }

      const result = await db.collection(ALERTS_COLL).findOneAndUpdate(
        { tenantId, id: alertId },
        { $set: { status: 'ACTION_TAKEN', actionTaken, updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' },
      );

      return NextResponse.json({ success: true, data: result });
    }

    // ── Resolve alert ─────────────────────────────────────────────
    if (action === 'resolve-alert') {
      const { alertId } = body;
      if (!alertId) return NextResponse.json({ success: false, error: 'alertId required' }, { status: 400 });

      const result = await db.collection(ALERTS_COLL).findOneAndUpdate(
        { tenantId, id: alertId },
        { $set: { status: 'RESOLVED', updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' },
      );

      return NextResponse.json({ success: true, data: result });
    }

    // ── Dismiss alert ─────────────────────────────────────────────
    if (action === 'dismiss-alert') {
      const { alertId } = body;
      if (!alertId) return NextResponse.json({ success: false, error: 'alertId required' }, { status: 400 });

      const result = await db.collection(ALERTS_COLL).findOneAndUpdate(
        { tenantId, id: alertId },
        { $set: { status: 'DISMISSED', updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' },
      );

      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    logger.error('Retention API POST error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Full calculation (used by POST calculate + auto-seed)
// ---------------------------------------------------------------------------

async function runFullCalculation(db: Db, tenantId: string) {
  const empCol = await getCVisionCollection(tenantId, 'employees');
  const employees = await empCol.find(
    createTenantFilter(tenantId, { status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] } } as Filter<Document>),
  ).limit(5000).toArray();

  if (employees.length === 0) {
    return { calculated: 0, newAlerts: 0, summary: null, topRisk: [] };
  }

  const data = await fetchAllRetentionData(db, tenantId, employees);
  const profiles = calculateAllRisks({
    employees: employees.map(e => toEmployeeInput(e, data.deptNames, data.jtNames)),
    salaryChanges: data.salaryChanges,
    performanceReviews: data.perfReviews,
    leaves: data.leaves,
    promotions: data.promotions,
    disciplinary: data.disciplinary,
    attendance: data.attendance,
    departmentSizes: data.deptSizes,
    previousScores: data.previousScores,
  });

  // Store scores
  if (profiles.length > 0) {
    await db.collection(SCORES_COLL).insertMany(
      profiles.map(p => ({ tenantId, ...p })),
    );
  }

  // Generate alerts for HIGH/CRITICAL
  const existingAlerts = await db.collection(ALERTS_COLL)
    .find({ tenantId, status: { $in: ['NEW', 'ACKNOWLEDGED'] } })
    .project({ employeeId: 1 })
    .limit(5000)
    .toArray();
  const existingIds = new Set<string>(existingAlerts.map((a) => ((a as Record<string, unknown>)).employeeId as string));
  const newAlerts = buildRetentionAlerts(profiles, tenantId, existingIds);
  if (newAlerts.length > 0) {
    await db.collection(ALERTS_COLL).insertMany(newAlerts);
  }

  const avgSalary = await getAvgSalary(db, tenantId);
  const summary = getOrganizationRiskSummary(profiles, avgSalary);

  return {
    calculated: profiles.length,
    newAlerts: newAlerts.length,
    summary,
    topRisk: profiles
      .sort((a, b) => b.flightRiskScore - a.flightRiskScore)
      .slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Auto-seed: ensure scores exist on first dashboard visit
// ---------------------------------------------------------------------------

let seedingInProgress = new Set<string>();

async function ensureScoresExist(db: Db, tenantId: string) {
  if (seedingInProgress.has(tenantId)) return;

  const count = await db.collection(SCORES_COLL).countDocuments({ tenantId }, { limit: 1 });
  if (count > 0) return;

  seedingInProgress.add(tenantId);
  try {
    await runFullCalculation(db, tenantId);
  } finally {
    seedingInProgress.delete(tenantId);
  }
}

// ---------------------------------------------------------------------------
// Helpers: latest profiles (deduplicated per employee)
// ---------------------------------------------------------------------------

async function getLatestProfiles(db: Db, tenantId: string): Promise<RetentionRiskProfile[]> {
  const scores = await db.collection(SCORES_COLL)
    .find({ tenantId })
    .sort({ calculatedAt: -1 })
    .limit(5000)
    .toArray();

  const latestByEmp = new Map<string, any>();
  for (const s of scores) {
    if (!latestByEmp.has(s.employeeId)) latestByEmp.set(s.employeeId, s);
  }
  return Array.from(latestByEmp.values()) as RetentionRiskProfile[];
}

async function getPreviousBatchAvg(db: Db, tenantId: string): Promise<number | null> {
  // Get the two most recent distinct calculatedAt timestamps
  const timestamps = await db.collection(SCORES_COLL)
    .aggregate([
      { $match: { tenantId } },
      { $group: { _id: '$calculatedAt' } },
      { $sort: { _id: -1 } },
      { $limit: 2 },
    ])
    .toArray();

  if (timestamps.length < 2) return null;

  const prevTimestamp = (timestamps[1] as Record<string, unknown>)._id;
  const prevScores = await db.collection(SCORES_COLL)
    .find({ tenantId, calculatedAt: prevTimestamp })
    .project({ flightRiskScore: 1 })
    .limit(5000)
    .toArray();

  if (prevScores.length === 0) return null;
  const sum = prevScores.reduce((s: number, r) => s + (((r as Record<string, unknown>)).flightRiskScore as number || 0), 0);
  return Math.round((sum / prevScores.length) * 10) / 10;
}

async function getAvgSalary(db: Db, tenantId: string): Promise<number> {
  try {
    const result = await db.collection('cvision_employees')
      .aggregate([
        { $match: { tenantId, basicSalary: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$basicSalary' } } },
      ])
      .toArray();
    return result[0]?.avg || 8000;
  } catch {
    return 8000;
  }
}

// ---------------------------------------------------------------------------
// Data fetching: bulk-load all related data for risk calculation
// ---------------------------------------------------------------------------

interface RetentionDataBundle {
  deptNames: Record<string, string>;
  jtNames: Record<string, string>;
  deptSizes: Record<string, number>;
  salaryChanges: SalaryChangeRecord[];
  perfReviews: PerformanceReviewRecord[];
  leaves: LeaveRecord[];
  promotions: PromotionRecord[];
  disciplinary: DisciplinaryRecord[];
  attendance: AttendanceRecord[];
  previousScores: HistoricalScore[];
}

async function fetchAllRetentionData(
  db: Db,
  tenantId: string,
  employees: any[],
): Promise<RetentionDataBundle> {
  const employeeIds = employees.map(e => e.id);
  const now = new Date();

  // Department names
  const deptDocs = await db.collection('cvision_departments')
    .find({ tenantId }).limit(500).toArray();
  const deptNames: Record<string, string> = {};
  for (const d of deptDocs) {
    const doc = d as Record<string, unknown>;
    deptNames[doc.id as string] = (doc.name as string) || (doc.id as string);
  }

  // Job title names
  const jtDocs = await db.collection('cvision_job_titles')
    .find({ tenantId }).limit(500).toArray();
  const jtNames: Record<string, string> = {};
  for (const jt of jtDocs) {
    const doc = jt as Record<string, unknown>;
    jtNames[doc.id as string] = (doc.nameEn as string) || (doc.name as string) || (doc.id as string);
  }

  // Department sizes (from the employee list itself)
  const deptSizes: Record<string, number> = {};
  for (const e of employees) {
    deptSizes[e.departmentId] = (deptSizes[e.departmentId] || 0) + 1;
  }

  // Parallel data fetches — each wrapped in try/catch so missing collections don't break everything
  const [
    salaryDocs, perfDocs, leaveDocs, promoDocs, discDocs, attendDocs, prevScoreDocs,
  ] = await Promise.all([
    safeFind(db, 'cvision_payroll_profiles', { tenantId, employeeId: { $in: employeeIds } }),
    safeFind(db, 'cvision_performance_reviews', { tenantId, employeeId: { $in: employeeIds } }),
    safeFind(db, 'cvision_leaves', {
      tenantId,
      employeeId: { $in: employeeIds },
      status: { $in: ['APPROVED', 'approved'] },
    }),
    safeFind(db, 'cvision_promotions', { tenantId, employeeId: { $in: employeeIds } }),
    safeFind(db, 'cvision_disciplinary', { tenantId, employeeId: { $in: employeeIds } }),
    safeFind(db, ATTENDANCE_COLL, {
      tenantId,
      employeeId: { $in: employeeIds },
      date: { $gte: new Date(now.getFullYear(), now.getMonth() - 6, 1) },
    }),
    safeFind(db, SCORES_COLL, { tenantId, employeeId: { $in: employeeIds } }),
  ]);

  const salaryChanges: SalaryChangeRecord[] = salaryDocs.map((p) => ({
    employeeId: ((p as Record<string, unknown>)).employeeId as string,
    effectiveDate: (((p as Record<string, unknown>)).updatedAt || ((p as Record<string, unknown>)).createdAt || now.toISOString()) as string,
    newSalary: (((p as Record<string, unknown>)).basicSalary as number) || 0,
    previousSalary: ((p as Record<string, unknown>)).previousBasicSalary as number | undefined,
  }));

  const perfReviews: PerformanceReviewRecord[] = perfDocs.map((r) => ({
    employeeId: ((r as Record<string, unknown>)).employeeId as string,
    cycleId: ((r as Record<string, unknown>)).cycleId as string,
    finalScore: (((r as Record<string, unknown>)).finalScore as number) || 0,
    rating: (((r as Record<string, unknown>)).rating as string) || '',
    completedAt: ((r as Record<string, unknown>)).completedAt as string,
  }));

  const leaves: LeaveRecord[] = leaveDocs.map((l) => ({
    employeeId: ((l as Record<string, unknown>)).employeeId as string,
    type: (((l as Record<string, unknown>)).leaveType as string) || (((l as Record<string, unknown>)).type as string) || '',
    startDate: ((l as Record<string, unknown>)).startDate as string,
    endDate: ((l as Record<string, unknown>)).endDate as string,
    totalDays: (((l as Record<string, unknown>)).days as number) || (((l as Record<string, unknown>)).totalDays as number) || 0,
    status: (((l as Record<string, unknown>)).status as string) || '',
  }));

  const promotions: PromotionRecord[] = promoDocs.map((p) => ({
    employeeId: ((p as Record<string, unknown>)).employeeId as string,
    effectiveDate: (((p as Record<string, unknown>)).effectiveDate || ((p as Record<string, unknown>)).createdAt) as string,
    newJobTitle: ((p as Record<string, unknown>)).newJobTitle as string,
    newGrade: ((p as Record<string, unknown>)).newGrade as string,
  }));

  const disciplinary: DisciplinaryRecord[] = discDocs.map((d) => {
    const doc = d as Record<string, unknown>;
    return {
      employeeId: doc.employeeId as string,
      type: (doc.type as string) || '',
      severity: (doc.severity as string) || '',
      status: (doc.status as string) || '',
      isActive: doc.isActive !== false && doc.status !== 'EXPIRED' && doc.status !== 'REVOKED',
      createdAt: doc.createdAt as string,
    };
  });

  const attendance: AttendanceRecord[] = attendDocs.map((a) => ({
    employeeId: ((a as Record<string, unknown>)).employeeId as string,
    date: ((a as Record<string, unknown>)).date as string,
    status: (((a as Record<string, unknown>)).status as string) || '',
    overtimeMinutes: (((a as Record<string, unknown>)).overtimeMinutes as number) || (((a as Record<string, unknown>)).overtime as number) || 0,
    lateMinutes: (((a as Record<string, unknown>)).lateMinutes as number) || 0,
  }));

  // Deduplicate previous scores to latest per employee
  const prevMap = new Map<string, HistoricalScore>();
  for (const s of prevScoreDocs) {
    if (!prevMap.has(s.employeeId)) {
      prevMap.set(s.employeeId, {
        employeeId: s.employeeId,
        flightRiskScore: s.flightRiskScore,
        calculatedAt: s.calculatedAt,
      });
    }
  }

  return {
    deptNames,
    jtNames,
    deptSizes,
    salaryChanges,
    perfReviews,
    leaves,
    promotions,
    disciplinary,
    attendance,
    previousScores: Array.from(prevMap.values()),
  };
}

/** Safe collection find — returns [] if the collection doesn't exist or errors */
async function safeFind(db: Db, collection: string, filter: any, limit = 5000): Promise<Document[]> {
  try {
    return await db.collection(collection).find(filter).limit(limit).toArray();
  } catch {
    return [];
  }
}

function toEmployeeInput(emp: any, deptNames: Record<string, string>, jtNames?: Record<string, string>): EmployeeInput {
  return {
    id: emp.id as string,
    name: `${(emp.firstName as string) || ''} ${(emp.lastName as string) || ''}`.trim() || (emp.fullName as string) || '',
    department: deptNames[emp.departmentId as string] || (emp.departmentId as string) || '',
    departmentId: (emp.departmentId as string) || '',
    jobTitle: (jtNames && jtNames[emp.jobTitleId as string]) || (emp.jobTitleId as string) || '',
    hireDate: (emp.hiredAt || emp.hireDate || emp.joinDate || null) as string | null,
    basicSalary: (emp.basicSalary as number) || 0,
    managerId: emp.managerId as string | undefined,
    managerName: emp.managerName as string | undefined,
  };
}
