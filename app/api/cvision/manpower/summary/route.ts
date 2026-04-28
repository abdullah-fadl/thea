import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Manpower Summary API
 * GET /api/cvision/manpower/summary - Get manpower summary (budget vs actual)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type {
  CVisionDepartment,
  CVisionBudgetedPosition,
  CVisionEmployee,
  CVisionJobTitle,
  CVisionUnit,
} from '@/lib/cvision/types';
import { requireCtx } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ManpowerSummaryRow {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  positionId: string | null; // null for unassigned
  positionCode: string | null;
  positionTitle: string;
  unitId: string | null;
  unitCode: string | null;
  unitName: string | null;
  budgetedHeadcount: number;
  activeHeadcount: number;
  exited30d: number;
  variance: number;
  utilizationPct: number;
}

interface ManpowerSummaryResponse {
  success: boolean;
  asOf: string;
  rows: ManpowerSummaryRow[];
  totals: {
    budgetedHeadcount: number;
    activeHeadcount: number;
    exited30d: number;
    variance: number;
  };
  departmentTotals: Record<string, {
    budgetedHeadcount: number;
    activeHeadcount: number;
    exited30d: number;
    variance: number;
  }>;
}

// GET - Get manpower summary
export const GET = withAuthTenant(
  async (request, { tenantId, userId }, params) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult;
      }

      const { searchParams } = new URL(request.url);
      const departmentId = searchParams.get('departmentId') || undefined;
      const asOfParam = searchParams.get('asOf');
      const asOf = asOfParam ? new Date(asOfParam) : new Date();
      const thirtyDaysAgo = new Date(asOf.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get departments and budgeted positions (PR-D1: Source of Truth)
      const deptCollection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );
      const positionCollection = await getCVisionCollection<CVisionBudgetedPosition>(
        tenantId,
        'budgetedPositions'
      );
      const empCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );
      const jobTitleCollection = await getCVisionCollection<CVisionJobTitle>(
        tenantId,
        'jobTitles'
      );
      const unitCollection = await getCVisionCollection<CVisionUnit>(
        tenantId,
        'units'
      );

      // Get all active budgeted positions (source of truth for budgeted headcount)
      let positionFilter: Record<string, any> = createTenantFilter(tenantId, { isActive: true });
      if (departmentId) {
        positionFilter.departmentId = departmentId;
      }
      const positions = await positionCollection.find(positionFilter).limit(5000).toArray();

      // Batch-fetch job titles and units for display names
      const jobTitleIds = [...new Set(positions.map(p => p.jobTitleId).filter(Boolean))];
      const unitIds = [...new Set(positions.map(p => p.unitId).filter(Boolean))] as string[];

      const jobTitles = jobTitleIds.length > 0
        ? await jobTitleCollection.find(createTenantFilter(tenantId, { id: { $in: jobTitleIds } })).limit(5000).toArray()
        : [];
      const units = unitIds.length > 0
        ? await unitCollection.find(createTenantFilter(tenantId, { id: { $in: unitIds } })).limit(5000).toArray()
        : [];

      const jtMap = new Map(jobTitles.map((jt) => [jt.id, jt]));
      const unitMap = new Map(units.map((u) => [u.id, u]));

      if (process.env.NODE_ENV === 'development') {
        logger.info('[CVision Manpower Summary] Found budgeted positions:', positions.length);
      }

      // Build rows from budgeted positions
      const rows: ManpowerSummaryRow[] = [];
      const rowMap = new Map<string, ManpowerSummaryRow>(); // key: `${departmentId}:${positionId}`

      // Step 1: Process budgeted positions
      for (const position of positions) {
        try {
          // Get department details
          const department = await deptCollection.findOne(
            createTenantFilter(tenantId, { id: position.departmentId })
          );

          if (!department) {
            if (process.env.NODE_ENV === 'development') {
              logger.info('[CVision Manpower Summary] Skipping position - missing department:', {
                positionId: position.id,
                departmentId: position.departmentId,
              });
            }
            continue;
          }

          // Budgeted headcount comes directly from position (source of truth)
          const budgetedHeadcount = position.budgetedHeadcount || 0;

          // Count active employees matching this dept+position
          // Include both ACTIVE and PROBATION employees (case-insensitive for legacy data)
          const activeFilter: Record<string, any> = {
            ...createTenantFilter(tenantId, {
              departmentId: position.departmentId,
              positionId: position.id,
              status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation', 'Active', 'Probation'] },
              isArchived: { $ne: true },
            }),
          };
          const activeCount = await empCollection.countDocuments(activeFilter);

          // Count exited in last 30 days
          const exitedFilter: Record<string, any> = {
            ...createTenantFilter(tenantId, {
              departmentId: position.departmentId,
              positionId: position.id,
              status: { $in: ['RESIGNED', 'TERMINATED'] },
              isArchived: { $ne: true },
              $or: [
                { statusEffectiveAt: { $gte: thirtyDaysAgo } },
                { terminatedAt: { $gte: thirtyDaysAgo } },
                { resignedAt: { $gte: thirtyDaysAgo } },
              ],
            }),
          };
          const exitedCount = await empCollection.countDocuments(exitedFilter);

          // Variance = budgetedHeadcount - activeHeadcount
          const variance = budgetedHeadcount - activeCount;
          const utilizationPct = budgetedHeadcount > 0
            ? (activeCount / budgetedHeadcount) * 100
            : 0;

          // Resolve job title and unit names for display
          const jt = position.jobTitleId ? jtMap.get(position.jobTitleId) : null;
          const unit = position.unitId ? unitMap.get(position.unitId) : null;
          const displayName = [jt?.name, unit?.name].filter(Boolean).join(' - ');

          const rowKey = `${position.departmentId}:${position.id}`;
          rowMap.set(rowKey, {
            departmentId: department.id,
            departmentCode: department.code,
            departmentName: department.name,
            positionId: position.id,
            positionCode: position.positionCode,
            positionTitle: displayName || position.title || position.positionCode,
            unitId: position.unitId || null,
            unitCode: unit?.code || null,
            unitName: unit?.name || null,
            budgetedHeadcount,
            activeHeadcount: activeCount,
            exited30d: exitedCount,
            variance,
            utilizationPct,
          });
        } catch (positionError: any) {
          logger.error('[CVision Manpower Summary] Error processing position:', {
            positionId: position.id,
            error: positionError.message,
          });
          continue;
        }
      }

      // Step 2: Process actual employees to find unassigned ones (no positionId)
      // Get all active employees with departmentId but no positionId (case-insensitive for legacy data)
      const employeeFilter: Record<string, any> = {
        ...createTenantFilter(tenantId, {
          status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation', 'Active', 'Probation'] },
          isArchived: { $ne: true },
          departmentId: departmentId || { $exists: true, $ne: null },
          $or: [
            { positionId: null },
            { positionId: { $exists: false } },
            { positionId: '' },
          ],
        }),
      };
      if (departmentId) {
        employeeFilter.departmentId = departmentId;
      }

      const unassignedEmployees = await empCollection.find(employeeFilter).limit(5000).toArray();

      // Group unassigned employees by departmentId
      const unassignedGroups = new Map<string, CVisionEmployee[]>();
      for (const emp of unassignedEmployees) {
        if (!emp.departmentId) continue;
        
        if (!unassignedGroups.has(emp.departmentId)) {
          unassignedGroups.set(emp.departmentId, []);
        }
        unassignedGroups.get(emp.departmentId)!.push(emp);
      }

      // Create rows for unassigned employees
      for (const [deptId, employees] of unassignedGroups.entries()) {
        const groupKey = `${deptId}:__UNASSIGNED_POSITION__`;
        if (rowMap.has(groupKey)) continue; // Already processed

        const department = await deptCollection.findOne(
          createTenantFilter(tenantId, { id: deptId })
        );
        if (!department) continue;

        const activeCount = employees.length;
        
        // Count exited in last 30 days for unassigned employees
        const exitedFilter: Record<string, any> = {
          ...createTenantFilter(tenantId, {
            departmentId: deptId,
            status: { $in: ['RESIGNED', 'TERMINATED'] },
            isArchived: { $ne: true },
            $or: [
              { positionId: null },
              { positionId: { $exists: false } },
            ],
            $and: [
              {
                $or: [
                  { statusEffectiveAt: { $gte: thirtyDaysAgo } },
                  { terminatedAt: { $gte: thirtyDaysAgo } },
                  { resignedAt: { $gte: thirtyDaysAgo } },
                ],
              },
            ],
          }),
        };
        
        const exitedCount = await empCollection.countDocuments(exitedFilter);

        // For unassigned positions, budgetedHeadcount is 0
        const budgetedHeadcount = 0;
        const variance = budgetedHeadcount - activeCount;
        const utilizationPct = 0;

        rowMap.set(groupKey, {
          departmentId: department.id,
          departmentCode: department.code,
          departmentName: department.name,
          positionId: null,
          positionCode: null,
          positionTitle: 'Unassigned',
          unitId: null,
          unitCode: null,
          unitName: null,
          budgetedHeadcount,
          activeHeadcount: activeCount,
          exited30d: exitedCount,
          variance,
          utilizationPct,
        });
      }

      // Convert map to array
      rows.push(...Array.from(rowMap.values()));

      // Calculate totals
      const totals = rows.reduce(
        (acc, row) => ({
          budgetedHeadcount: acc.budgetedHeadcount + row.budgetedHeadcount,
          activeHeadcount: acc.activeHeadcount + row.activeHeadcount,
          exited30d: acc.exited30d + row.exited30d,
          variance: acc.variance + row.variance,
        }),
        { budgetedHeadcount: 0, activeHeadcount: 0, exited30d: 0, variance: 0 }
      );

      // Calculate department totals
      const departmentTotals: Record<string, any> = {};
      for (const row of rows) {
        if (!departmentTotals[row.departmentId]) {
          departmentTotals[row.departmentId] = {
            budgetedHeadcount: 0,
            activeHeadcount: 0,
            exited30d: 0,
            variance: 0,
          };
        }
        departmentTotals[row.departmentId].budgetedHeadcount += row.budgetedHeadcount;
        departmentTotals[row.departmentId].activeHeadcount += row.activeHeadcount;
        departmentTotals[row.departmentId].exited30d += row.exited30d;
        departmentTotals[row.departmentId].variance += row.variance;
      }

      // Count employees without positionId for diagnostics
      const unassignedCount = rows
        .filter(r => r.positionId === null)
        .reduce((sum, r) => sum + r.activeHeadcount, 0);

      return NextResponse.json({
        success: true,
        asOf: asOf.toISOString(),
        rows,
        totals,
        departmentTotals,
        metadata: {
          unassignedEmployeesCount: unassignedCount,
        },
      } as ManpowerSummaryResponse & { metadata?: { unassignedEmployeesCount: number } });
    } catch (error: any) {
      logger.error('[CVision Manpower Summary GET]', error?.message || String(error), error?.stack);
      return NextResponse.json(
        { 
          error: 'Internal server error', 
          message: error.message,
          code: 'MANPOWER_SUMMARY_ERROR',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);
