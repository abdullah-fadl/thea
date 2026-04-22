import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Manpower Dashboard API
 * GET /api/cvision/dashboard/manpower?range=30|90
 * 
 * Computes per-department manpower metrics:
 * - budgetedHeadcount: Sum of budgetedHeadcount from positions
 * - activeHeadcount: Count of employees with status ACTIVE or PROBATION (non-archived, active departments only)
 * - exited: Count of employees RESIGNED/TERMINATED in last 30/90 days
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
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ManpowerMetrics {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  budgetedHeadcount: number;
  activeHeadcount: number;
  exited: number; // RESIGNED/TERMINATED in last N days
  variance: number; // budgetedHeadcount - activeHeadcount
  utilizationPercent: number; // (activeHeadcount / budgetedHeadcount) * 100
}

// GET - Get manpower dashboard data
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role }) => {
    try {
      const { searchParams } = new URL(request.url);
      const rangeParam = searchParams.get('range') || '30';
      const rangeDays = rangeParam === '90' ? 90 : 30;

      if (process.env.NODE_ENV === 'development') {
        logger.info('[CVision Manpower Dashboard GET]', {
          tenantId,
          userId,
          role,
          rangeDays,
        });
      }

      // Get all active, non-archived departments only
      const deptCollection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );
      const departments = await deptCollection
        .find(createTenantFilter(tenantId, {
          isArchived: { $ne: true },
          isActive: true
        }))
        .limit(500)
        .toArray();

      // Get all budgeted positions (for budgetedHeadcount) - PR-D1: Source of Truth
      const positionCollection = await getCVisionCollection<CVisionBudgetedPosition>(
        tenantId,
        'budgetedPositions'
      );
      const positions = await positionCollection
        .find(createTenantFilter(tenantId, { isActive: true }))
        .limit(5000)
        .toArray();

      // Get all employees
      const empCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      // Calculate date threshold for exited employees
      const now = new Date();
      const thresholdDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);

      // Compute metrics per department
      const metrics: ManpowerMetrics[] = [];

      // Debug: Log all active employees regardless of department (for troubleshooting)
      if (process.env.NODE_ENV === 'development') {
        const allActiveEmployees = await empCollection
          .find(createTenantFilter(tenantId, {
            status: { $in: ['ACTIVE', 'PROBATION'] },
            isArchived: { $ne: true },
          }))
          .limit(5000)
          .toArray();
        logger.info('[CVision Manpower Dashboard] All active employees (dev):', {
          total: allActiveEmployees.length,
          employees: allActiveEmployees.map((e: any) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName}`,
            status: e.status,
            departmentId: e.departmentId,
            isArchived: e.isArchived,
          })),
        });
      }

      for (const dept of departments) {
        // Budgeted headcount: sum of budgetedHeadcount from positions in this department (PR-B: from PositionBudget)
        const deptPositions = positions.filter((p) => p.departmentId === dept.id);
        const budgetedHeadcount = deptPositions.reduce(
          (sum, p) => sum + (p.budgetedHeadcount || 0),
          0
        );

        // Active headcount: count employees directly assigned to this department with ACTIVE/PROBATION status
        // This is the source of truth - employees.departmentId determines their department
        // Position Slots are optional organizational assignments (PR-B enhancement)
        const activeCount = await empCollection.countDocuments(
          createTenantFilter(tenantId, {
            departmentId: dept.id,
            status: { $in: ['ACTIVE', 'PROBATION'] },
            isArchived: { $ne: true },
          })
        );
        
        // Debug: Log department-specific counts
        if (process.env.NODE_ENV === 'development') {
          const deptFilter = createTenantFilter(tenantId, {
            departmentId: dept.id,
            status: { $in: ['ACTIVE', 'PROBATION'] },
            isArchived: { $ne: true },
          });
          const deptEmployees = await empCollection.find(deptFilter).limit(5000).toArray();
          logger.info(`[CVision Manpower Dashboard] Department ${dept.name} (${dept.code}):`, {
            departmentId: dept.id,
            activeCount,
            employees: deptEmployees.map((e: any) => ({
              id: e.id,
              name: `${e.firstName} ${e.lastName}`,
              status: e.status,
              departmentId: e.departmentId,
            })),
          });
        }
        
        // Count unassigned (ACTIVE but no positionId) for dev diagnostics
        let unassignedCount = 0;
        if (process.env.NODE_ENV === 'development') {
          const unassignedBaseFilter = createTenantFilter(tenantId, {
            departmentId: dept.id,
            status: { $in: ['ACTIVE', 'PROBATION'] },
            isArchived: { $ne: true },
          });
          const unassignedFilter = {
            ...unassignedBaseFilter,
            $or: [
              { positionId: null },
              { positionId: { $exists: false } },
            ],
          };
          unassignedCount = await empCollection.countDocuments(unassignedFilter);
        }

        // Exited: employees RESIGNED or TERMINATED in last N days
        // Check statusEffectiveAt (from Prisma schema) to determine when they exited
        // For terminated employees, also check terminatedAt field
        const baseFilter = createTenantFilter(tenantId, {
          departmentId: dept.id,
          status: { $in: ['RESIGNED', 'TERMINATED'] },
          isArchived: { $ne: true },
        });

        // Combine tenant filter with date filter using $and
        // createTenantFilter may add $or for deletedAt, so we need to preserve it
        const exitedFilter: Record<string, any> = {
          tenantId: baseFilter.tenantId,
          departmentId: dept.id,
          status: { $in: ['RESIGNED', 'TERMINATED'] }, // Canonical uppercase
          isArchived: { $ne: true },
          $and: [
            ...(baseFilter.$or ? [{ $or: baseFilter.$or }] : []),
            {
              $or: [
                { statusEffectiveAt: { $gte: thresholdDate } },
                { updatedAt: { $gte: thresholdDate } },
                { terminatedAt: { $gte: thresholdDate } },
                { resignedAt: { $gte: thresholdDate } },
              ],
            },
          ],
        };

        const exitedEmployees = await empCollection.find(exitedFilter).limit(5000).toArray();
        const exited = exitedEmployees.length;

        const variance = budgetedHeadcount - activeCount;
        const utilizationPercent =
          budgetedHeadcount > 0 ? (activeCount / budgetedHeadcount) * 100 : 0;

        metrics.push({
          departmentId: dept.id,
          departmentCode: dept.code,
          departmentName: dept.name,
          budgetedHeadcount,
          activeHeadcount: activeCount,
          exited,
          variance,
          utilizationPercent: Math.round(utilizationPercent * 100) / 100, // Round to 2 decimals
          ...(process.env.NODE_ENV === 'development' && unassignedCount > 0 ? { unassignedCount } : {}),
        });
      }

      // Find employees with missing or invalid departmentId (not in active departments)
      const allActiveEmployees = await empCollection
        .find(createTenantFilter(tenantId, {
          status: { $in: ['ACTIVE', 'PROBATION'] },
          isArchived: { $ne: true },
        }))
        .limit(5000)
        .toArray();
      
      const departmentIds = new Set(departments.map(d => d.id));
      const employeesWithoutDept = allActiveEmployees.filter((e: any) => 
        !e.departmentId || !departmentIds.has(e.departmentId)
      );
      
      // Add "Unassigned" department for employees without valid departmentId
      if (employeesWithoutDept.length > 0) {
        const unassignedActiveCount = employeesWithoutDept.length;
        metrics.push({
          departmentId: 'unassigned',
          departmentCode: 'UNASSIGNED',
          departmentName: 'Unassigned',
          budgetedHeadcount: 0,
          activeHeadcount: unassignedActiveCount,
          exited: 0,
          variance: -unassignedActiveCount,
          utilizationPercent: 0,
        });
        
        if (process.env.NODE_ENV === 'development') {
          logger.warn('[CVision Manpower Dashboard] Employees missing or invalid departmentId:', {
            count: employeesWithoutDept.length,
            employees: employeesWithoutDept.map((e: any) => ({
              id: e.id,
              name: `${e.firstName} ${e.lastName}`,
              status: e.status,
              departmentId: e.departmentId,
              message: e.departmentId 
                ? `Department ID ${e.departmentId} not found in active departments`
                : 'No departmentId assigned',
            })),
          });
        }
      }
      
      // Sort by department code (Unassigned will be last)
      metrics.sort((a, b) => {
        if (a.departmentId === 'unassigned') return 1;
        if (b.departmentId === 'unassigned') return -1;
        return a.departmentCode.localeCompare(b.departmentCode);
      });

      // Calculate totals
      const totals: {
        budgetedHeadcount: number;
        activeHeadcount: number;
        exited: number;
        variance: number;
        utilizationPercent: number;
      } = {
        budgetedHeadcount: metrics.reduce((sum, m) => sum + m.budgetedHeadcount, 0),
        activeHeadcount: metrics.reduce((sum, m) => sum + m.activeHeadcount, 0),
        exited: metrics.reduce((sum, m) => sum + m.exited, 0),
        variance: 0,
        utilizationPercent: 0,
      };

      // Debug: Log count comparison
      if (process.env.NODE_ENV === 'development') {
        const totalActiveInManpower = totals.activeHeadcount;
        const totalActiveInSystem = allActiveEmployees.length;
        if (totalActiveInSystem !== totalActiveInManpower) {
          logger.warn('[CVision Manpower Dashboard] Count mismatch:', {
            totalActiveInSystem,
            totalActiveInManpower,
            difference: totalActiveInSystem - totalActiveInManpower,
            message: 'Some active employees are not assigned to active departments',
          });
        } else {
          logger.info('[CVision Manpower Dashboard] Count match:', {
            totalActiveInSystem,
            totalActiveInManpower,
          });
        }
      }

      totals.variance = totals.budgetedHeadcount - totals.activeHeadcount;
      totals.utilizationPercent =
        totals.budgetedHeadcount > 0
          ? Math.round((totals.activeHeadcount / totals.budgetedHeadcount) * 100 * 100) / 100
          : 0;

      if (process.env.NODE_ENV === 'development') {
        logger.info('[CVision Manpower Dashboard GET] Result:', {
          tenantId,
          rangeDays,
          departments: metrics.length,
          totals,
        });
      }

      return NextResponse.json({
        success: true,
        range: rangeDays,
        metrics,
        totals,
      });
    } catch (error: any) {
      logger.error('[CVision Manpower Dashboard GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);
