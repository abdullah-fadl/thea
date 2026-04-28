/**
 * CVision Headcount Budget Engine (Live Data)
 *
 * Computes headcount budget data from live collections:
 *   - departments          → department list
 *   - budgetedPositions    → budgeted headcount per position
 *   - cvision_employees    → actual headcount & salary costs
 *   - jobTitles            → position display names
 *   - cvision_headcount_budget → salary budget overrides (optional)
 *   - cvision_position_requests → position change requests
 *
 * All data is computed on-the-fly so Headcount, Manpower, and
 * Organization pages always show the same source of truth.
 */
import type { Db, Document } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type BudgetStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE';
export type PositionRequestType = 'NEW_POSITION' | 'BACKFILL' | 'UPGRADE' | 'FREEZE' | 'UNFREEZE';
export type PositionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export const REQUEST_TYPE_LABELS: Record<PositionRequestType, string> = {
  NEW_POSITION: 'New Position', BACKFILL: 'Backfill', UPGRADE: 'Upgrade',
  FREEZE: 'Freeze Position', UNFREEZE: 'Unfreeze Position',
};

/* ── Collections ───────────────────────────────────────────────────── */

const DEPT_COL     = 'cvision_departments';
const POS_COL      = 'cvision_budgeted_positions';
const EMP_COL      = 'cvision_employees';
const JT_COL       = 'cvision_job_titles';
const BUDGET_COL   = 'cvision_headcount_budget';
const REQUEST_COL  = 'cvision_position_requests';

/* ── Helpers ───────────────────────────────────────────────────────── */

const ACTIVE_STATUSES = ['ACTIVE', 'PROBATION', 'active', 'probation', 'Active', 'Probation'];

interface PositionRow {
  positionTitle: string;
  positionId: string;
  budgeted: number;
  filled: number;
  open: number;
  frozen: boolean;
  averageSalary: number;
  totalCost: number;
}

interface DepartmentBudget {
  departmentId: string;
  departmentName: string;
  budgetedHeadcount: number;
  currentHeadcount: number;
  variance: number;
  positions: PositionRow[];
  totalSalaryBudget: number;
  currentSalaryCost: number;
  remainingBudget: number;
  utilizationPercentage: number;
  projectedYearEndCost: number;
  projectedOverUnder: number;
}

/**
 * Build the full headcount budget from live collections.
 * This replaces the old seed-data approach.
 */
export async function getLiveBudget(db: Db, tenantId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const monthsPassed = now.getMonth() + 1; // Jan = 1
  const monthsLeft = 12 - monthsPassed;

  // 1. Get all active departments
  const departments = await db.collection(DEPT_COL)
    .find({ tenantId, isArchived: { $ne: true } })
    .sort({ name: 1 })
    .toArray();

  if (departments.length === 0) {
    return null; // No departments configured yet
  }

  // 2. Get all active budgeted positions
  const allPositions = await db.collection(POS_COL)
    .find({ tenantId, isActive: true })
    .toArray();

  // 3. Get all active employees (batch query once)
  const allEmployees = await db.collection(EMP_COL)
    .find({
      tenantId,
      status: { $in: ACTIVE_STATUSES },
      isArchived: { $ne: true },
    })
    .toArray();

  // 4. Get job titles for display names
  const jtIds = [...new Set(allPositions.map((p) => p.jobTitleId).filter(Boolean))];
  const jobTitles = jtIds.length > 0
    ? await db.collection(JT_COL).find({ tenantId, id: { $in: jtIds } }).toArray()
    : [];
  const jtMap = new Map(jobTitles.map((jt) => [jt.id, jt]));

  // 5. Get saved salary budget overrides (optional)
  const savedBudget = await db.collection(BUDGET_COL).findOne({ tenantId, year });

  // 6. Get frozen positions from saved budget
  const frozenSet = new Set<string>();
  if (savedBudget?.departments) {
    for (const d of savedBudget.departments as Document[]) {
      for (const p of d.positions || []) {
        if (p.frozen) frozenSet.add(`${d.departmentId}:${p.positionTitle}`);
      }
    }
  }

  // Build maps for efficient lookup
  const positionsByDept = new Map<string, Document[]>();
  for (const pos of allPositions) {
    const deptId = pos.departmentId;
    if (!positionsByDept.has(deptId)) positionsByDept.set(deptId, []);
    positionsByDept.get(deptId)!.push(pos);
  }

  const employeesByPosition = new Map<string, Document[]>();
  const employeesByDept = new Map<string, Document[]>();
  for (const emp of allEmployees) {
    const deptId = emp.departmentId;
    const posId = emp.positionId;

    if (!employeesByDept.has(deptId)) employeesByDept.set(deptId, []);
    employeesByDept.get(deptId)!.push(emp);

    if (posId) {
      if (!employeesByPosition.has(posId)) employeesByPosition.set(posId, []);
      employeesByPosition.get(posId)!.push(emp);
    }
  }

  // 7. Build department budget data
  const deptBudgets: DepartmentBudget[] = [];

  for (const dept of departments) {
    const deptId = dept.id;
    const deptName = dept.name || dept.nameAr || 'Unknown';
    const deptPositions = positionsByDept.get(deptId) || [];
    const deptEmployees = employeesByDept.get(deptId) || [];

    // Compute positions
    const positionRows: PositionRow[] = [];
    let totalBudgeted = 0;
    let totalFilled = 0;

    for (const pos of deptPositions) {
      const posId = pos.id;
      const budgeted = pos.budgetedHeadcount || 0;
      const posEmployees = employeesByPosition.get(posId) || [];
      const filled = posEmployees.length;
      const open = Math.max(0, budgeted - filled);

      const jt = pos.jobTitleId ? jtMap.get(pos.jobTitleId) : null;
      const title = jt?.name || pos.title || pos.positionCode || 'Untitled';

      // Check frozen status
      const isFrozen = frozenSet.has(`${deptId}:${title}`);

      // Calculate salary from actual employees in this position
      const totalSalary = posEmployees.reduce((sum: number, e: Document) => sum + (e.basicSalary || e.salary || 0), 0);
      const avgSalary = filled > 0 ? Math.round(totalSalary / filled) : 0;

      positionRows.push({
        positionTitle: title,
        positionId: posId,
        budgeted,
        filled,
        open,
        frozen: isFrozen,
        averageSalary: avgSalary,
        totalCost: totalSalary,
      });

      totalBudgeted += budgeted;
      totalFilled += filled;
    }

    // Also count employees in this department who don't have a positionId
    const unassignedEmps = deptEmployees.filter((e) => !e.positionId);
    if (unassignedEmps.length > 0) {
      const unassignedSalary = unassignedEmps.reduce((sum: number, e: Document) => sum + (e.basicSalary || e.salary || 0), 0);
      positionRows.push({
        positionTitle: 'Unassigned Employees',
        positionId: '__unassigned__',
        budgeted: 0,
        filled: unassignedEmps.length,
        open: 0,
        frozen: false,
        averageSalary: unassignedEmps.length > 0 ? Math.round(unassignedSalary / unassignedEmps.length) : 0,
        totalCost: unassignedSalary,
      });
      totalFilled += unassignedEmps.length;
    }

    const currentHeadcount = deptEmployees.length; // actual active employees in dept
    const variance = totalBudgeted - currentHeadcount;

    // Salary costs from live employees
    const currentSalaryCost = deptEmployees.reduce((sum: number, e: Document) => sum + (e.basicSalary || e.salary || 0), 0);
    const monthlyCost = currentSalaryCost; // monthly total
    const annualCost = monthlyCost * 12;

    // Salary budget: prefer saved override, otherwise estimate from budgeted positions
    const savedDept = (savedBudget?.departments as Document[] | undefined)?.find?.((d) => d.departmentId === deptId);
    const totalSalaryBudget = savedDept?.totalSalaryBudget || annualCost * 1.1; // default: 10% above current

    const remainingBudget = totalSalaryBudget - annualCost;
    const utilizationPercentage = totalSalaryBudget > 0 ? Math.round((annualCost / totalSalaryBudget) * 100) : 0;

    // Projection: extrapolate current monthly cost to year-end
    const projectedYearEndCost = monthsPassed > 0
      ? Math.round((annualCost / monthsPassed) * 12)
      : annualCost;
    const projectedOverUnder = Math.round(totalSalaryBudget - projectedYearEndCost);

    deptBudgets.push({
      departmentId: deptId,
      departmentName: deptName,
      budgetedHeadcount: totalBudgeted,
      currentHeadcount,
      variance,
      positions: positionRows,
      totalSalaryBudget,
      currentSalaryCost: annualCost,
      remainingBudget,
      utilizationPercentage,
      projectedYearEndCost,
      projectedOverUnder,
    });
  }

  // 8. Compute totals
  const totalBudgetedHeadcount = deptBudgets.reduce((s, d) => s + d.budgetedHeadcount, 0);
  const totalCurrentHeadcount = deptBudgets.reduce((s, d) => s + d.currentHeadcount, 0);
  const totalSalaryBudget = deptBudgets.reduce((s, d) => s + d.totalSalaryBudget, 0);
  const totalCurrentCost = deptBudgets.reduce((s, d) => s + d.currentSalaryCost, 0);

  return {
    tenantId,
    year,
    departments: deptBudgets,
    totalBudgetedHeadcount,
    totalCurrentHeadcount,
    totalSalaryBudget,
    totalCurrentCost,
    status: (savedBudget?.status as BudgetStatus) || 'ACTIVE',
    approvedBy: savedBudget?.approvedBy || null,
    approvedAt: savedBudget?.approvedAt || null,
    createdAt: savedBudget?.createdAt || new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get variance report computed from live data.
 */
export async function getVarianceReport(db: Db, tenantId: string, _year: number) {
  const budget = await getLiveBudget(db, tenantId);
  if (!budget) return null;

  return budget.departments.map((d) => ({
    departmentId: d.departmentId,
    department: d.departmentName,
    budgeted: d.budgetedHeadcount,
    current: d.currentHeadcount,
    variance: d.variance,
    budgetUtilization: d.utilizationPercentage,
    frozen: d.positions.filter((p) => p.frozen).length,
    openPositions: d.positions.reduce((s, p) => s + p.open, 0),
  }));
}

/**
 * Get projections computed from live data.
 */
export async function getProjections(db: Db, tenantId: string, _year: number) {
  const budget = await getLiveBudget(db, tenantId);
  if (!budget) return null;

  return budget.departments.map((d) => ({
    departmentId: d.departmentId,
    department: d.departmentName,
    currentCost: d.currentSalaryCost,
    budget: d.totalSalaryBudget,
    projected: d.projectedYearEndCost,
    overUnder: d.projectedOverUnder,
  }));
}

/**
 * Save/update salary budget overrides for a department.
 * This allows HR to set explicit budget targets that override the computed defaults.
 */
export async function saveSalaryBudget(
  db: Db, tenantId: string, year: number,
  departmentId: string, totalSalaryBudget: number
) {
  const coll = db.collection(BUDGET_COL);
  const existing = await coll.findOne({ tenantId, year });

  if (!existing) {
    // Create new budget doc with this department override
    await coll.insertOne({
      tenantId, year,
      departments: [{ departmentId, totalSalaryBudget }],
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    // Update or add department budget
    const depts = (existing.departments || []) as Document[];
    const idx = depts.findIndex((d) => d.departmentId === departmentId);
    if (idx >= 0) {
      depts[idx] = { ...depts[idx], totalSalaryBudget };
    } else {
      depts.push({ departmentId, totalSalaryBudget });
    }
    await coll.updateOne(
      { tenantId, year },
      { $set: { departments: depts, updatedAt: new Date() } }
    );
  }

  return { success: true };
}
