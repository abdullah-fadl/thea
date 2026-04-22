import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Headcount Planning API (Live Data)
 *
 * All budget data is now computed from live collections:
 *   departments + budgetedPositions + employees
 *
 * This ensures Headcount, Manpower Summary, and Organization pages
 * always display the same source of truth.
 *
 * GET  ?action=budget               → full budget (live computed)
 * GET  ?action=department-detail    → single department detail
 * GET  ?action=variance-report      → variance per department
 * GET  ?action=projections          → year-end projections
 * GET  ?action=frozen-positions     → frozen position list
 * GET  ?action=utilization          → budget utilization per dept
 * GET  ?action=requests             → position change requests
 *
 * POST action=create-budget         → set salary budget targets
 * POST action=approve-budget        → approve budget
 * POST action=request-position      → request new position
 * POST action=approve-position      → approve/reject request
 * POST action=freeze-position       → freeze a position
 * POST action=unfreeze              → unfreeze a position
 * POST action=update-projections    → (no-op, projections are live)
 * POST action=set-salary-budget     → set salary budget for a department
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { getLiveBudget, getVarianceReport, getProjections, saveSalaryBudget } from '@/lib/cvision/headcount/headcount-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BUDGET_COLL = 'cvision_headcount_budget';
const REQUEST_COLL = 'cvision_position_requests';

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'budget';

  try {
    if (action === 'budget') {
      const budget = await getLiveBudget(db, tenantId);
      return NextResponse.json({ ok: true, budget });
    }

    if (action === 'department-detail') {
      const deptId = searchParams.get('departmentId');
      const budget = await getLiveBudget(db, tenantId);
      if (!budget) return NextResponse.json({ ok: false, error: 'No data found' }, { status: 404 });
      const dept = budget.departments.find((d: any) => d.departmentId === deptId);
      return NextResponse.json({ ok: true, department: dept || null });
    }

    if (action === 'variance-report') {
      const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
      const report = await getVarianceReport(db, tenantId, year);
      return NextResponse.json({ ok: true, report });
    }

    if (action === 'projections') {
      const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
      const projections = await getProjections(db, tenantId, year);
      return NextResponse.json({ ok: true, projections });
    }

    if (action === 'frozen-positions') {
      const budget = await getLiveBudget(db, tenantId);
      const frozen: any[] = [];
      for (const dept of budget?.departments || []) {
        for (const pos of dept.positions || []) {
          if (pos.frozen) frozen.push({ department: dept.departmentName, departmentId: dept.departmentId, ...pos });
        }
      }
      return NextResponse.json({ ok: true, frozen });
    }

    if (action === 'utilization') {
      const budget = await getLiveBudget(db, tenantId);
      const utilization = (budget?.departments || []).map((d: any) => ({
        department: d.departmentName,
        departmentId: d.departmentId,
        utilization: d.utilizationPercentage,
        budget: d.totalSalaryBudget,
        spent: d.currentSalaryCost,
        remaining: d.remainingBudget,
      }));
      return NextResponse.json({ ok: true, utilization });
    }

    if (action === 'requests') {
      const status = searchParams.get('status');
      const filter: any = { tenantId };
      if (status) filter.status = status;
      const requests = await db.collection(REQUEST_COLL).find(filter).sort({ createdAt: -1 }).limit(200).toArray();
      return NextResponse.json({ ok: true, requests });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    logger.error('[Headcount GET]', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal error' }, { status: 500 });
  }
},
  { platformKey: 'cvision', permissionKey: 'cvision.manpower.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const { action } = body;

  try {
    if (action === 'create-budget' || action === 'set-salary-budget') {
      // Allow HR to set explicit salary budget targets per department
      const { year, departmentId, totalSalaryBudget, departments } = body;
      const budgetYear = year || new Date().getFullYear();

      if (departments && Array.isArray(departments)) {
        // Bulk set budgets for multiple departments
        for (const d of departments) {
          if (d.departmentId && d.totalSalaryBudget) {
            await saveSalaryBudget(db, tenantId, budgetYear, d.departmentId, d.totalSalaryBudget);
          }
        }
      } else if (departmentId && totalSalaryBudget) {
        await saveSalaryBudget(db, tenantId, budgetYear, departmentId, totalSalaryBudget);
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'approve-budget') {
      const { year } = body;
      await db.collection(BUDGET_COLL).updateOne(
        { tenantId, year },
        { $set: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date(), updatedAt: new Date() } },
      );
      return NextResponse.json({ ok: true });
    }

    if (action === 'request-position') {
      const { type, departmentId, positionTitle, justification, estimatedSalary } = body;
      const annualCost = (estimatedSalary || 0) * 12 * 1.3;
      const count = await db.collection(REQUEST_COLL).countDocuments({ tenantId });
      await db.collection(REQUEST_COLL).insertOne({
        tenantId, requestId: `PR-${String(count + 1).padStart(3, '0')}`,
        type, departmentId, positionTitle, justification,
        estimatedSalary, annualCost, budgetAvailable: true,
        status: 'PENDING', approvals: [], createdAt: new Date(),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'approve-position') {
      const { requestId, decision } = body;
      const status = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
      await db.collection(REQUEST_COLL).updateOne(
        { tenantId, requestId },
        { $set: { status }, $push: { approvals: { step: userId || 'HR', decision: status, date: new Date() } } },
      );
      return NextResponse.json({ ok: true });
    }

    if (action === 'freeze-position') {
      const { year, departmentId, positionTitle } = body;
      const budgetYear = year || new Date().getFullYear();
      const coll = db.collection(BUDGET_COLL);
      const existing = await coll.findOne({ tenantId, year: budgetYear });

      if (!existing) {
        // Create budget doc with frozen position
        await coll.insertOne({
          tenantId, year: budgetYear,
          departments: [{ departmentId, positions: [{ positionTitle, frozen: true }] }],
          createdAt: new Date(), updatedAt: new Date(),
        });
      } else {
        const depts = ((existing.departments || []) as unknown[]).map((d: any) => {
          if (d.departmentId !== departmentId) return d;
          const positions = (d.positions || []).map((p: any) =>
            p.positionTitle === positionTitle ? { ...p, frozen: true } : p
          );
          // Add position if not found
          if (!positions.some((p: any) => p.positionTitle === positionTitle)) {
            positions.push({ positionTitle, frozen: true });
          }
          return { ...d, positions };
        });
        // Add department if not found
        if (!depts.some((d: any) => d.departmentId === departmentId)) {
          depts.push({ departmentId, positions: [{ positionTitle, frozen: true }] });
        }
        await coll.updateOne({ tenantId, year: budgetYear }, { $set: { departments: depts, updatedAt: new Date() } });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'unfreeze') {
      const { year, departmentId, positionTitle } = body;
      const budgetYear = year || new Date().getFullYear();
      const coll = db.collection(BUDGET_COLL);
      const existing = await coll.findOne({ tenantId, year: budgetYear });
      if (!existing) return NextResponse.json({ ok: true }); // nothing to unfreeze
      const depts = ((existing.departments || []) as unknown[]).map((d: any) => {
        if (d.departmentId !== departmentId) return d;
        return { ...d, positions: (d.positions || []).map((p: any) =>
          p.positionTitle === positionTitle ? { ...p, frozen: false } : p
        ) };
      });
      await coll.updateOne({ tenantId, year: budgetYear }, { $set: { departments: depts, updatedAt: new Date() } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'update-projections') {
      // Projections are now computed from live data — this is a no-op
      // but kept for backward compatibility
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    logger.error('[Headcount POST]', err);
    return NextResponse.json({ ok: false, error: err.message || 'Internal error' }, { status: 500 });
  }
},
  { platformKey: 'cvision', permissionKey: 'cvision.manpower.write' });
