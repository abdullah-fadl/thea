import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Positions Summary API
 * GET /api/cvision/positions/summary - Get budget vs actual headcount summary
 * 
 * Returns position summary with budgeted vs actual headcount.
 * activeHeadcount is computed/derived from active employees.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type {
  CVisionPosition,
  CVisionDepartment,
  CVisionJobTitle,
  CVisionGrade,
  CVisionEmployee,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PositionSummary {
  id: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  jobTitleId: string;
  jobTitleCode: string;
  jobTitleName: string;
  gradeId?: string | null;
  gradeCode?: string | null;
  gradeName?: string | null;
  budgetedHeadcount: number;
  activeHeadcount: number;
  variance: number; // budgetedHeadcount - activeHeadcount
  utilizationPercent: number; // (activeHeadcount / budgetedHeadcount) * 100
  isActive: boolean;
}

/**
 * Compute active headcount for a position
 * Counts employees with matching departmentId, jobTitleId, and gradeId (if specified)
 * Only counts active employees (status: 'active' or 'probation')
 */
async function computeActiveHeadcount(
  tenantId: string,
  position: CVisionPosition
): Promise<number> {
  const empCollection = await getCVisionCollection<CVisionEmployee>(
    tenantId,
    'employees'
  );

  const baseFilter = createTenantFilter(tenantId);
  const filter: Record<string, any> = {
    ...baseFilter,
    departmentId: position.departmentId,
    jobTitleId: position.jobTitleId,
    isActive: true,
    status: { $in: ['active', 'ACTIVE', 'probation', 'PROBATION'] },
  };

  // If gradeId is specified, filter by it; otherwise, only count employees without gradeId
  if (position.gradeId) {
    filter.gradeId = position.gradeId;
  } else {
    // Combine with existing $or from createTenantFilter if it exists
    const gradeFilter = {
      $or: [
        { gradeId: null },
        { gradeId: { $exists: false } },
      ],
    };
    if (baseFilter.$or) {
      filter.$and = [
        { $or: baseFilter.$or },
        gradeFilter,
      ];
      delete filter.$or;
    } else {
      filter.$or = gradeFilter.$or;
    }
  }

  const count = await empCollection.countDocuments(filter);
  return count;
}

// GET - Get positions summary
export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const departmentId = searchParams.get('departmentId');
      const includeArchived = searchParams.get('includeArchived') === 'true';
      const includeInactive = searchParams.get('includeInactive') === 'true';

      const positionCollection = await getCVisionCollection<CVisionPosition>(
        tenantId,
        'positions'
      );
      const deptCollection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );
      const jobTitleCollection = await getCVisionCollection<CVisionJobTitle>(
        tenantId,
        'jobTitles'
      );
      const gradeCollection = await getCVisionCollection<CVisionGrade>(
        tenantId,
        'grades'
      );

      // Build filter
      const filter: Record<string, any> = createTenantFilter(tenantId);
      if (departmentId) {
        filter.departmentId = departmentId;
      }
      if (!includeArchived) {
        filter.isArchived = false;
      }
      if (!includeInactive) {
        filter.isActive = true;
      }

      // Fetch positions
      const positions = await positionCollection.find(filter).limit(5000).toArray();

      // Fetch related departments, job titles, and grades
      const deptIds = [...new Set(positions.map((p) => p.departmentId))];
      const jobTitleIds = [...new Set(positions.map((p) => p.jobTitleId))];
      const gradeIds = positions
        .map((p) => p.gradeId)
        .filter((id): id is string => !!id);

      const [departments, jobTitles, grades] = await Promise.all([
        deptCollection
          .find(createTenantFilter(tenantId, { id: { $in: deptIds } }))
          .toArray(),
        jobTitleCollection
          .find(createTenantFilter(tenantId, { id: { $in: jobTitleIds } }))
          .toArray(),
        gradeIds.length > 0
          ? gradeCollection
              .find(createTenantFilter(tenantId, { id: { $in: gradeIds } }))
              .toArray()
          : Promise.resolve([]),
      ]);

      // Create lookup maps
      const deptMap = new Map(departments.map((d) => [d.id, d]));
      const jobTitleMap = new Map(jobTitles.map((jt) => [jt.id, jt]));
      const gradeMap = new Map(grades.map((g) => [g.id, g]));

      // Compute active headcount for each position and build summary
      const summaries: PositionSummary[] = await Promise.all(
        positions.map(async (position) => {
          const activeHeadcount = await computeActiveHeadcount(tenantId, position);
          const department = deptMap.get(position.departmentId);
          const jobTitle = jobTitleMap.get(position.jobTitleId);
          const grade = position.gradeId ? gradeMap.get(position.gradeId) : null;

          const variance = position.budgetedHeadcount - activeHeadcount;
          const utilizationPercent =
            position.budgetedHeadcount > 0
              ? (activeHeadcount / position.budgetedHeadcount) * 100
              : 0;

          return {
            id: position.id,
            departmentId: position.departmentId,
            departmentCode: department?.code || 'N/A',
            departmentName: department?.name || 'Unknown',
            jobTitleId: position.jobTitleId,
            jobTitleCode: jobTitle?.code || 'N/A',
            jobTitleName: jobTitle?.name || 'Unknown',
            gradeId: position.gradeId || null,
            gradeCode: grade?.code || null,
            gradeName: grade?.name || null,
            budgetedHeadcount: position.budgetedHeadcount,
            activeHeadcount,
            variance,
            utilizationPercent: Math.round(utilizationPercent * 100) / 100,
            isActive: position.isActive,
          };
        })
      );

      // Sort by department code, then job title code
      summaries.sort((a, b) => {
        const deptCompare = a.departmentCode.localeCompare(b.departmentCode);
        if (deptCompare !== 0) return deptCompare;
        return a.jobTitleCode.localeCompare(b.jobTitleCode);
      });

      // Calculate totals
      const totals = {
        budgetedHeadcount: summaries.reduce((sum, s) => sum + s.budgetedHeadcount, 0),
        activeHeadcount: summaries.reduce((sum, s) => sum + s.activeHeadcount, 0),
        variance: summaries.reduce((sum, s) => sum + s.variance, 0),
      };

      return NextResponse.json({
        success: true,
        positions: summaries,
        totals,
        count: summaries.length,
      });
    } catch (error: any) {
      logger.error('[CVision Positions Summary GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);
