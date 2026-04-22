import { logger } from '@/lib/monitoring/logger';
/**
 * CVision What-If Analysis API (Enhanced)
 *
 * GET  actions: current-state, saved-scenarios
 * POST actions: simulate, save-scenario, compare, quick-salary, quick-hires, quick-burnout
 *
 * Fetches live employee + retention data, runs enhanced scenarios through
 * whatif-engine, returns results with retention/Nitaqat/GOSI projections.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSessionAndTenant, middlewareError } from '@/lib/cvision/middleware';
import { getCVisionDb, getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import { isSaudiEmployee } from '@/lib/cvision/saudi-utils';
import { calculateGOSIContribution } from '@/lib/cvision/integrations/shared/helpers';
import {
  simulateSalaryIncrease,
  simulateNewHires,
  simulateLayoffs,
  simulatePromotionWave,
  simulateBurnoutRelief,
  compareScenarios,
  calculateEndOfService,
  type WhatIfEmployee,
  type WhatIfResult,
  type SalaryIncreaseParams,
  type NewHiresParams,
  type LayoffsParams,
  type PromotionWaveParams,
  type BurnoutReliefParams,
  type BurnoutAction,
  type ScenarioType,
} from '@/lib/cvision/whatif/whatif-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SCENARIOS_COLL = 'cvision_whatif_scenarios';

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) return middlewareError(authResult);

    const { tenantId } = authResult.data;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'current-state';

    const db = await getCVisionDb(tenantId);

    // ── Current state ─────────────────────────────────────────────
    if (action === 'current-state') {
      const employees = await fetchWhatIfEmployees(db, tenantId);

      const saudiCount = employees.filter(e => e.isSaudi).length;
      const totalPayroll = employees.reduce((s, e) => e.basicSalary + e.housingAllowance + e.transportAllowance + s, 0);
      const totalGOSI = employees.reduce((s, e) => {
        return s + calculateGOSIContribution(e.basicSalary, e.housingAllowance, e.isSaudi).employerContribution;
      }, 0);
      const avgRisk = employees.length > 0
        ? employees.reduce((s, e) => s + e.riskScore, 0) / employees.length
        : 0;
      const rate = employees.length > 0 ? Math.round((saudiCount / employees.length) * 10000) / 100 : 0;

      // Department breakdown
      const deptMap = new Map<string, { count: number; payroll: number; saudi: number; riskSum: number }>();
      for (const e of employees) {
        const d = deptMap.get(e.department) || { count: 0, payroll: 0, saudi: 0, riskSum: 0 };
        d.count++;
        d.payroll += e.basicSalary + e.housingAllowance + e.transportAllowance;
        if (e.isSaudi) d.saudi++;
        d.riskSum += e.riskScore;
        deptMap.set(e.department, d);
      }

      const departments = Array.from(deptMap.entries()).map(([dept, d]) => ({
        department: dept,
        headcount: d.count,
        totalPayroll: Math.round(d.payroll),
        avgSalary: d.count > 0 ? Math.round(d.payroll / d.count) : 0,
        saudiCount: d.saudi,
        avgRiskScore: d.count > 0 ? Math.round(d.riskSum / d.count * 10) / 10 : 0,
      })).sort((a, b) => b.headcount - a.headcount);

      return NextResponse.json({
        success: true,
        data: {
          totalEmployees: employees.length,
          monthlyPayroll: Math.round(totalPayroll),
          annualPayroll: Math.round(totalPayroll * 12),
          avgSalary: employees.length > 0 ? Math.round(totalPayroll / employees.length) : 0,
          saudiEmployees: saudiCount,
          nonSaudiEmployees: employees.length - saudiCount,
          saudizationRate: rate,
          gosiEmployerMonthly: Math.round(totalGOSI),
          avgRiskScore: Math.round(avgRisk * 10) / 10,
          departments,
          employees: employees.map(e => ({
            id: e.id,
            name: e.name,
            department: e.department,
            departmentId: e.departmentId,
            jobTitle: e.jobTitle,
            basicSalary: e.basicSalary,
            isSaudi: e.isSaudi,
            riskScore: e.riskScore,
            hireDate: e.hireDate,
          })),
        },
      });
    }

    // ── Saved scenarios ───────────────────────────────────────────
    if (action === 'saved-scenarios') {
      const limit = Math.min(200, parseInt(searchParams.get('limit') || '50', 10));
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

      const coll = db.collection(SCENARIOS_COLL);
      const total = await coll.countDocuments({ tenantId });
      const scenarios = await coll
        .find({ tenantId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      return NextResponse.json({
        success: true,
        data: scenarios.map((s: any) => ({
          id: s.id,
          name: s.name,
          nameAr: s.nameAr,
          type: s.type,
          summary: s.results?.summary,
          monthlyCostDifference: s.results?.monthlyCostDifference,
          riskScoreChange: s.results?.riskScoreChange,
          createdAt: s.createdAt,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    logger.error('What-If API GET error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
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
    const db = await getCVisionDb(tenantId);

    // ── Simulate (main entrypoint) ────────────────────────────────
    if (action === 'simulate') {
      const { type, parameters } = body as { type: ScenarioType; parameters: any };
      if (!type || !parameters) {
        return NextResponse.json({ success: false, error: 'type and parameters required' }, { status: 400 });
      }

      const employees = await fetchWhatIfEmployees(db, tenantId);
      const result = runScenario(type, employees, parameters);

      return NextResponse.json({ success: true, data: { result } });
    }

    // ── Save scenario ─────────────────────────────────────────────
    if (action === 'save-scenario') {
      const { name, nameAr, type, parameters, results } = body;
      if (!name || !type || !results) {
        return NextResponse.json({ success: false, error: 'name, type, and results required' }, { status: 400 });
      }

      const doc = {
        id: `wif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        tenantId,
        name,
        nameAr: nameAr || name,
        type,
        parameters: parameters || {},
        results,
        createdAt: new Date().toISOString(),
        createdBy: userId,
      };
      await db.collection(SCENARIOS_COLL).insertOne(doc);

      return NextResponse.json({ success: true, data: { id: doc.id } });
    }

    // ── Compare ───────────────────────────────────────────────────
    if (action === 'compare') {
      const { scenario1, scenario2 } = body;
      if (!scenario1 || !scenario2) {
        return NextResponse.json({ success: false, error: 'scenario1 and scenario2 required (each with type + parameters)' }, { status: 400 });
      }

      const employees = await fetchWhatIfEmployees(db, tenantId);
      const result1 = runScenario(scenario1.type, employees, scenario1.parameters);
      const result2 = runScenario(scenario2.type, employees, scenario2.parameters);
      const comparison = compareScenarios(result1, result2);

      return NextResponse.json({
        success: true,
        data: {
          scenario1: { ...scenario1, result: result1 },
          scenario2: { ...scenario2, result: result2 },
          comparison,
        },
      });
    }

    // ── Quick: salary increase ────────────────────────────────────
    if (action === 'quick-salary') {
      const { percentage, scope, department, employeeIds } = body;
      if (!percentage || typeof percentage !== 'number') {
        return NextResponse.json({ success: false, error: 'percentage (number) required' }, { status: 400 });
      }

      const employees = await fetchWhatIfEmployees(db, tenantId);
      const result = simulateSalaryIncrease(employees, {
        percentage,
        scope: scope || 'ALL',
        department,
        employeeIds,
      });

      return NextResponse.json({ success: true, data: { result } });
    }

    // ── Quick: new hires ──────────────────────────────────────────
    if (action === 'quick-hires') {
      const { positions } = body;
      if (!positions || !Array.isArray(positions) || positions.length === 0) {
        return NextResponse.json({ success: false, error: 'positions array required' }, { status: 400 });
      }

      const employees = await fetchWhatIfEmployees(db, tenantId);
      const result = simulateNewHires(employees, { positions });

      return NextResponse.json({ success: true, data: { result } });
    }

    // ── Quick: burnout relief ─────────────────────────────────────
    if (action === 'quick-burnout') {
      const { actions: burnoutActions } = body;
      if (!burnoutActions || !Array.isArray(burnoutActions) || burnoutActions.length === 0) {
        return NextResponse.json({ success: false, error: 'actions array required' }, { status: 400 });
      }

      const employees = await fetchWhatIfEmployees(db, tenantId);
      const result = simulateBurnoutRelief(employees, { actions: burnoutActions as BurnoutAction[] });

      return NextResponse.json({ success: true, data: { result } });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    logger.error('What-If API POST error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Run scenario by type
// ---------------------------------------------------------------------------

function runScenario(type: ScenarioType, employees: WhatIfEmployee[], parameters: any): WhatIfResult {
  switch (type) {
    case 'SALARY_INCREASE':
      return simulateSalaryIncrease(employees, parameters as SalaryIncreaseParams);
    case 'NEW_HIRES':
      return simulateNewHires(employees, parameters as NewHiresParams);
    case 'LAYOFFS':
      return simulateLayoffs(employees, parameters as LayoffsParams);
    case 'PROMOTION_WAVE':
      return simulatePromotionWave(employees, parameters as PromotionWaveParams);
    case 'BURNOUT_RELIEF':
      return simulateBurnoutRelief(employees, parameters as BurnoutReliefParams);
    default:
      throw new Error(`Unknown scenario type: ${type}`);
  }
}

// ---------------------------------------------------------------------------
// Data fetching: employees + retention scores
// ---------------------------------------------------------------------------

async function fetchWhatIfEmployees(db: any, tenantId: string): Promise<WhatIfEmployee[]> {
  const empCol = await getCVisionCollection<any>(tenantId, 'employees');
  const employees = await empCol.find(
    createTenantFilter(tenantId, { status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] } } as Record<string, unknown>),
  ).toArray();

  // Fetch latest retention scores
  const scoreMap = new Map<string, { riskScore: number; factors: Record<string, number> }>();
  try {
    const scores = await db.collection('cvision_retention_scores')
      .find({ tenantId })
      .sort({ calculatedAt: -1 })
      .toArray();

    for (const s of scores as Record<string, unknown>[]) {
      if (!scoreMap.has(s.employeeId as string)) {
        const factorMap: Record<string, number> = {};
        if (Array.isArray(s.factors)) {
          for (const f of s.factors as Record<string, any>[]) factorMap[f.id] = f.score;
        }
        scoreMap.set(s.employeeId as string, { riskScore: (s.flightRiskScore as number) || 35, factors: factorMap });
      }
    }
  } catch {
    // Retention scores may not exist yet — use neutral defaults
  }

  // Fetch department names
  const deptDocs = await safeFind(db, 'cvision_departments', { tenantId });
  const deptNames: Record<string, string> = {};
  for (const d of deptDocs as Record<string, any>[]) deptNames[d.id] = d.name || d.id;

  // Fetch job title names
  const jtDocs = await safeFind(db, 'cvision_job_titles', { tenantId });
  const jtNames: Record<string, string> = {};
  for (const jt of jtDocs as Record<string, any>[]) jtNames[jt.id] = jt.nameEn || jt.name || jt.id;

  return employees.map((emp: any) => {
    const score = scoreMap.get(emp.id);
    return {
      id: emp.id,
      name: emp.fullNameEn || emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || '',
      department: deptNames[emp.departmentId] || emp.departmentId || '',
      departmentId: emp.departmentId || '',
      jobTitle: jtNames[emp.jobTitleId] || emp.jobTitle || '',
      basicSalary: emp.basicSalary || 0,
      housingAllowance: emp.housingAllowance || 0,
      transportAllowance: emp.transportAllowance || 0,
      isSaudi: isSaudiEmployee(emp),
      nationalId: emp.nationalId,
      nationality: emp.nationality,
      hireDate: emp.hiredAt || emp.hireDate || emp.joinDate || null,
      riskScore: score?.riskScore ?? 35,
      riskFactors: score?.factors,
    };
  });
}

async function safeFind(db: any, collection: string, filter: any): Promise<any[]> {
  try { return await db.collection(collection).find(filter).limit(1000).toArray(); }
  catch { return []; }
}
