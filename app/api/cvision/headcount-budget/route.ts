import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import type { Filter, Document } from 'mongodb';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import type { AuthzContext } from '@/lib/cvision/authz/types';
import { v4 as uuid } from 'uuid';
import type {
  CVisionDepartment,
  CVisionBudgetedPosition,
  CVisionEmployee,
  CVisionJobTitle,
  CVisionGrade,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function hasPerm(ctx: AuthzContext, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

/**
 * Build live headcount data from actual departments, budgeted positions, and employees.
 * Uses the same DB access pattern as manpower/summary (getCVisionCollection + createTenantFilter).
 */
async function buildLiveHeadcount(tenantId: string) {
  // Get typed collections — same pattern as the working manpower/summary API
  const deptCollection = await getCVisionCollection<CVisionDepartment>(tenantId, 'departments');
  const positionCollection = await getCVisionCollection<CVisionBudgetedPosition>(tenantId, 'budgetedPositions');
  const empCollection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
  const jobTitleCollection = await getCVisionCollection<CVisionJobTitle>(tenantId, 'jobTitles');
  const gradeCollection = await getCVisionCollection<CVisionGrade>(tenantId, 'grades');

  // 1. All active departments (using createTenantFilter for proper soft-delete handling)
  const departments = await deptCollection.find(
    createTenantFilter(tenantId, { isActive: true } as Filter<CVisionDepartment>)
  ).limit(500).toArray();

  // Also include departments where isActive doesn't exist (legacy data)
  const deptsMaybeNoFlag = await deptCollection.find(
    createTenantFilter(tenantId, { isActive: { $exists: false } } as Filter<CVisionDepartment>)
  ).limit(500).toArray();

  // Merge and deduplicate by id
  const allDeptsMap = new Map<string, CVisionDepartment>();
  for (const d of [...departments, ...deptsMaybeNoFlag]) {
    if (d.id && !allDeptsMap.has(d.id)) {
      allDeptsMap.set(d.id, d);
    }
  }
  const allDepts = Array.from(allDeptsMap.values());

  if (process.env.NODE_ENV === 'development') {
    logger.info('[Headcount Budget] Found departments:', allDepts.length, allDepts.map(d => d.name));
  }

  // 2. All active budgeted positions
  const positions = await positionCollection.find(
    createTenantFilter(tenantId, { isActive: true } as Filter<CVisionBudgetedPosition>)
  ).limit(5000).toArray();

  if (process.env.NODE_ENV === 'development') {
    logger.info('[Headcount Budget] Found budgeted positions:', positions.length);
  }

  // 3. Batch-fetch job titles and grades for display names
  const jobTitleIds = [...new Set(positions.map(p => p.jobTitleId).filter(Boolean))];
  const gradeIds = [...new Set(positions.map(p => p.gradeId).filter(Boolean))] as string[];

  const jobTitles = jobTitleIds.length > 0
    ? await jobTitleCollection.find(createTenantFilter(tenantId, { id: { $in: jobTitleIds } } as Filter<CVisionJobTitle>)).limit(5000).toArray()
    : [];
  const grades = gradeIds.length > 0
    ? await gradeCollection.find(createTenantFilter(tenantId, { id: { $in: gradeIds } } as Filter<CVisionGrade>)).limit(1000).toArray()
    : [];

  const jtMap = new Map(jobTitles.map((jt) => [jt.id, jt]));
  const gradeMap = new Map(grades.map((g) => [g.id, g]));

  // 4. Count active employees per department using aggregation
  const activeStatuses = ['ACTIVE', 'PROBATION', 'active', 'probation', 'Active', 'Probation'];
  const empAgg = await empCollection.aggregate([
    {
      $match: {
        tenantId,
        status: { $in: activeStatuses },
        isArchived: { $ne: true },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      },
    },
    { $group: { _id: '$departmentId', count: { $sum: 1 } } },
  ]).toArray();
  const empCountMap = new Map(empAgg.map((r) => [(r as Record<string, unknown>)._id as string, (r as Record<string, unknown>).count as number]));

  // 5. Get compensation data (basic salary) per department for budget estimation
  const _costMap = new Map<string, number>();
  try {
    const compCollection = await getCVisionCollection(tenantId, 'employeeCompensation' as Parameters<typeof getCVisionCollection>[1]);
    const compAgg = await compCollection.aggregate([
      { $match: { tenantId } },
      {
        $lookup: {
          from: 'cvision_employees',
          let: { empId: '$employeeId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$id', '$$empId'] },
                tenantId,
                status: { $in: activeStatuses },
                isArchived: { $ne: true },
              },
            },
            { $project: { departmentId: 1 } },
          ],
          as: 'emp',
        },
      },
      { $unwind: { path: '$emp', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$emp.departmentId', totalMonthly: { $sum: { $ifNull: ['$basicSalary', 0] } } } },
    ]).toArray();

    for (const r of compAgg) {
      const doc = r as Record<string, unknown>;
      _costMap.set(doc._id as string, doc.totalMonthly as number);
    }
  } catch (e) {
    // Compensation data is optional — don't break if collection doesn't exist
    if (process.env.NODE_ENV === 'development') {
      logger.info('[Headcount Budget] Compensation lookup skipped:', e instanceof Error ? e.message : String(e));
    }
  }

  const costMap: Map<string, number> = _costMap;

  // 6. Count employees per position (departmentId + positionId) for position-level breakdown
  const empByPosAgg = await empCollection.aggregate([
    {
      $match: {
        tenantId,
        status: { $in: activeStatuses },
        isArchived: { $ne: true },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        positionId: { $exists: true, $nin: [null, ''] },
      } as Filter<CVisionEmployee>,
    },
    { $group: { _id: { departmentId: '$departmentId', positionId: '$positionId' }, count: { $sum: 1 } } },
  ]).toArray();
  const empByPosMap = new Map(empByPosAgg.map((r) => {
    const doc = r as Record<string, unknown>;
    const id = doc._id as Record<string, string>;
    return [`${id.departmentId}:${id.positionId}`, doc.count as number];
  }));

  // Also count employees by jobTitleId per department (for position matching when positionId is not set)
  const empByTitleAgg = await empCollection.aggregate([
    {
      $match: {
        tenantId,
        status: { $in: activeStatuses },
        isArchived: { $ne: true },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      },
    },
    { $group: { _id: { departmentId: '$departmentId', jobTitleId: '$jobTitleId' }, count: { $sum: 1 } } },
  ]).toArray();
  const empByTitleMap = new Map(empByTitleAgg.map((r) => {
    const doc = r as Record<string, unknown>;
    const id = doc._id as Record<string, string>;
    return [`${id.departmentId}:${id.jobTitleId}`, doc.count as number];
  }));

  // Build per-department budget
  const budgets: any[] = [];

  for (const dept of allDepts) {
    const deptPositions = positions.filter((p) => p.departmentId === dept.id);
    const approvedCount = deptPositions.reduce((s: number, p) => s + (p.budgetedHeadcount || 0), 0);
    const actualCount: number = empCountMap.get(dept.id) || 0;
    const monthlyCost: number = costMap.get(dept.id) || 0;

    // Build position-level breakdown
    const posBreakdown = deptPositions.map((p) => {
      const jt = p.jobTitleId ? jtMap.get(p.jobTitleId) : null;
      const grade = p.gradeId ? gradeMap.get(p.gradeId) : null;
      const displayTitle = (jt as Record<string, unknown> | null)?.name as string || p.title || p.positionCode || 'Untitled';
      const gradeName = ((grade as Record<string, unknown> | null)?.name as string) || '';

      // Count actual employees: try positionId match first, then jobTitleId match
      let posActualCount = empByPosMap.get(`${dept.id}:${p.id}`) || 0;
      if (posActualCount === 0 && p.jobTitleId) {
        posActualCount = empByTitleMap.get(`${dept.id}:${p.jobTitleId}`) || 0;
      }

      const budgeted = p.budgetedHeadcount || 0;
      let status = 'VACANT';
      if (posActualCount >= budgeted && budgeted > 0) status = 'FILLED';
      else if (posActualCount > 0) status = 'PARTIAL';

      return {
        positionId: p.id,
        title: displayTitle,
        gradeId: p.gradeId || '',
        gradeName,
        approvedCount: budgeted,
        actualCount: posActualCount,
        monthlyCost: 0,
        status,
      };
    });

    // If no budgeted positions but department has employees, create a single "Unassigned" entry
    if (posBreakdown.length === 0 && actualCount > 0) {
      posBreakdown.push({
        positionId: 'unassigned',
        title: 'Unassigned',
        gradeId: '',
        gradeName: '',
        approvedCount: 0,
        actualCount,
        monthlyCost,
        status: 'FILLED',
      });
    }

    budgets.push({
      budgetId: `live-${dept.id}`,
      departmentId: dept.id,
      departmentName: dept.name || dept.code || dept.id,
      departmentCode: dept.code || '',
      positions: posBreakdown,
      totalApproved: approvedCount,
      totalActual: actualCount,
      totalBudget: monthlyCost,
      variance: approvedCount - actualCount,
      status: approvedCount > 0 ? 'ACTIVE' : 'DRAFT',
      live: true,
      year: null, // Live-computed — no stored year
      approvedAt: null,
      approvedBy: null,
    });
  }

  // Sort by department name
  budgets.sort((a, b) => (a.departmentName || '').localeCompare(b.departmentName || ''));

  return budgets;
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.MANPOWER_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires MANPOWER_READ');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  // First check for stored budget records
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  // Check stored budgets using getCVisionDb for the raw collection
  const { getCVisionDb } = await import('@/lib/cvision/db');
  const db = await getCVisionDb(tenantId);
  const storedBudgets = await db.collection('cvision_headcount_budget').find({ tenantId, year }).limit(500).toArray();

  // Normalize stored budgets: flatten nested "departments" array to flat department objects
  // Stored seed data has { departments: [{ departmentId, departmentName, positions, ... }] }
  // Frontend expects flat array of { departmentName, totalApproved, totalActual, positions, ... }
  let budgets: any[];
  if (storedBudgets.length > 0) {
    budgets = [];
    for (const doc of storedBudgets) {
      const d = doc as Record<string, unknown>;
      if (d.departments && Array.isArray(d.departments)) {
        // Flatten nested departments
        for (const dept of d.departments as Record<string, unknown>[]) {
          const positions = ((dept.positions || []) as Record<string, unknown>[]).map((p) => ({
            positionId: p.positionId || p.positionTitle || '',
            title: p.positionTitle || p.title || 'Untitled',
            gradeId: p.gradeId || '',
            gradeName: p.gradeName || '',
            approvedCount: (p.budgeted as number) || (p.approvedCount as number) || 0,
            actualCount: (p.filled as number) || (p.actualCount as number) || 0,
            monthlyCost: (p.totalCost as number) || (p.monthlyCost as number) || 0,
            status: ((p.filled as number) || 0) >= ((p.budgeted as number) || 0) && ((p.budgeted as number) || 0) > 0 ? 'FILLED'
              : ((p.filled as number) || (p.actualCount as number) || 0) > 0 ? 'PARTIAL' : 'VACANT',
          }));
          const totalApproved = positions.reduce((s: number, p: any) => s + (p.approvedCount as number), 0);
          const totalActual = (dept.currentHeadcount as number) ?? positions.reduce((s: number, p: any) => s + (p.actualCount as number), 0);
          budgets.push({
            budgetId: d.budgetId || `stored-${dept.departmentId}`,
            departmentId: dept.departmentId,
            departmentName: dept.departmentName || dept.departmentId,
            departmentCode: dept.departmentCode || '',
            positions,
            totalApproved: (dept.budgetedHeadcount as number) || totalApproved,
            totalActual,
            totalBudget: dept.totalSalaryBudget ? Math.round((dept.totalSalaryBudget as number) / 12) : 0,
            variance: ((dept.budgetedHeadcount as number) || totalApproved) - totalActual,
            status: d.status || 'APPROVED',
            year: d.year || year,
            approvedAt: d.approvedAt || null,
            approvedBy: d.approvedBy || null,
            createdAt: d.createdAt || null,
          });
        }
      } else if (d.departmentName) {
        // Already in flat format — ensure year and approval metadata are included
        budgets.push({
          ...d,
          year: d.year || year,
          approvedAt: d.approvedAt || null,
          approvedBy: d.approvedBy || null,
        });
      }
    }
  } else {
    budgets = await buildLiveHeadcount(tenantId);
  }

  if (action === 'list') {
    return NextResponse.json({ ok: true, data: budgets });
  }

  if (action === 'get') {
    const id = searchParams.get('id');
    const doc = budgets.find((b) => b.budgetId === id);
    return NextResponse.json({ ok: true, data: doc || null });
  }

  if (action === 'summary') {
    let totalApproved = 0, totalActual = 0, totalBudget = 0, totalFilled = 0, totalVacant = 0, totalFrozen = 0;
    for (const b of budgets) {
      const bd = b as Record<string, unknown>;
      totalApproved += (bd.totalApproved as number) || 0;
      totalActual += (bd.totalActual as number) || 0;
      totalBudget += (bd.totalBudget as number) || 0;
      for (const pos of ((bd.positions || []) as Record<string, unknown>[])) {
        if (pos.status === 'FILLED') totalFilled += (pos.actualCount as number) || 0;
        if (pos.status === 'VACANT') totalVacant += Math.max(0, ((pos.approvedCount as number) || 0) - ((pos.actualCount as number) || 0));
        if (pos.status === 'PARTIAL') {
          totalFilled += (pos.actualCount as number) || 0;
          totalVacant += Math.max(0, ((pos.approvedCount as number) || 0) - ((pos.actualCount as number) || 0));
        }
        if (pos.status === 'FROZEN') totalFrozen += (pos.approvedCount as number) || 0;
      }
    }

    // Count budget approval statuses
    const approvedBudgets = budgets.filter((b) => ((b.status as string) || '').toUpperCase() === 'APPROVED').length;
    const draftBudgets = budgets.filter((b) => ((b.status as string) || '').toUpperCase() === 'DRAFT').length;
    const pendingBudgets = budgets.filter((b) => {
      const s = ((b.status as string) || '').toUpperCase();
      return s === 'PENDING_APPROVAL' || s === 'PENDING';
    }).length;
    const activeBudgets = budgets.filter((b) => ((b.status as string) || '').toUpperCase() === 'ACTIVE').length;

    return NextResponse.json({
      ok: true,
      data: {
        year, departments: budgets.length,
        totalApproved, totalActual, totalBudget, totalFilled, totalVacant, totalFrozen,
        variance: totalApproved - totalActual,
        approvedBudgets, draftBudgets, pendingBudgets, activeBudgets,
      },
    });
  }

  if (action === 'vacancies') {
    const vacancies: any[] = [];
    for (const b of budgets) {
      const bd = b as Record<string, unknown>;
      for (const pos of ((bd.positions || []) as Record<string, unknown>[])) {
        const gap = ((pos.approvedCount as number) || 0) - ((pos.actualCount as number) || 0);
        if (gap > 0 || pos.status === 'VACANT') {
          vacancies.push({
            department: bd.departmentName,
            departmentId: bd.departmentId,
            title: pos.title,
            gradeId: pos.gradeName || pos.gradeId || '-',
            gap: Math.max(0, gap),
            status: pos.status || 'VACANT',
          });
        }
      }
    }
    return NextResponse.json({ ok: true, data: vacancies });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.manpower.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.MANPOWER_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires MANPOWER_WRITE');
  const { getCVisionDb } = await import('@/lib/cvision/db');
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const positions = (body.positions || []).map((p: any) => ({
      positionId: (p.positionId as string) || uuid(), title: p.title, gradeId: (p.gradeId as string) || '',
      approvedCount: (p.approvedCount as number) || 0, actualCount: (p.actualCount as number) || 0,
      monthlyCost: (p.monthlyCost as number) || 0, status: (p.status as string) || 'VACANT',
    }));
    const totalApproved = positions.reduce((s: number, p: any) => s + (p.approvedCount as number), 0);
    const totalActual = positions.reduce((s: number, p: any) => s + (p.actualCount as number), 0);
    const totalBudget = positions.reduce((s: number, p: any) => s + ((p.monthlyCost as number) * (p.approvedCount as number)), 0);

    const doc = {
      tenantId, budgetId: uuid(), year: body.year || new Date().getFullYear(),
      departmentId: body.departmentId, departmentName: body.departmentName,
      positions, totalApproved, totalActual, totalBudget,
      status: body.status || 'DRAFT', createdBy: ctx.userId, createdAt: new Date(), updatedAt: new Date(),
    };
    await db.collection('cvision_headcount_budget').insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'update') {
    const update: any = { updatedAt: new Date() };
    if (body.positions) {
      update.positions = body.positions;
      update.totalApproved = body.positions.reduce((s: number, p: any) => s + ((p.approvedCount as number) || 0), 0);
      update.totalActual = body.positions.reduce((s: number, p: any) => s + ((p.actualCount as number) || 0), 0);
      update.totalBudget = body.positions.reduce((s: number, p: any) => s + (((p.monthlyCost as number) || 0) * ((p.approvedCount as number) || 0)), 0);
    }
    if (body.status) update.status = body.status;
    await db.collection('cvision_headcount_budget').updateOne({ tenantId, budgetId: body.budgetId }, { $set: update });
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve') {
    await db.collection('cvision_headcount_budget').updateOne(
      { tenantId, budgetId: body.budgetId },
      { $set: { status: 'APPROVED', approvedBy: ctx.userId, approvedAt: new Date(), updatedAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'reset-stored') {
    // Remove stale stored budget records for the given year so the page falls back to live data
    const year = body.year || new Date().getFullYear();
    const result = await db.collection('cvision_headcount_budget').deleteMany({ tenantId, year });
    return NextResponse.json({ ok: true, deletedCount: result.deletedCount, message: `Removed ${result.deletedCount} stored budget record(s) for year ${year}. Page will now use live data.` });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.manpower.write' });
