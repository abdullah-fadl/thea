import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Admin API - Delete All Positions
 * DELETE /api/cvision/admin/delete-all-positions
 * 
 * WARNING: This deletes ALL position types and department-position assignments for the tenant.
 * Use with caution!
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { CVISION_ROLES } from '@/lib/cvision/roles';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import type { CVisionPositionType, CVisionDepartmentPosition } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// DELETE - Delete all positions
export const DELETE = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      // Build authz context to check roles properly
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      // Only allow OWNER or THEA_OWNER role for this dangerous operation
      const isOwner = ctx.roles.includes(CVISION_ROLES.OWNER) || 
                      ctx.roles.includes(CVISION_ROLES.THEA_OWNER) ||
                      ctx.isOwner ||
                      role === CVISION_ROLES.OWNER ||
                      role === CVISION_ROLES.THEA_OWNER;
      
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Only OWNER can delete all positions' },
          { status: 403 }
        );
      }

      const positionCollection = await getCVisionCollection<CVisionPositionType>(
        tenantId,
        'positionTypes'
      );
      
      const assignmentCollection = await getCVisionCollection<CVisionDepartmentPosition>(
        tenantId,
        'departmentPositions'
      );

      // Get all positions before deletion for audit
      const allPositions = await positionCollection
        .find(createTenantFilter(tenantId, {}, true)) // Include archived
        .toArray();
      
      const allAssignments = await assignmentCollection
        .find(createTenantFilter(tenantId, {}, true)) // Include archived
        .toArray();

      // Delete all department-position assignments first
      const assignmentFilter = createTenantFilter(tenantId, {}, true);
      const assignmentDeleteResult = await assignmentCollection.deleteMany(assignmentFilter);

      // Delete all position types
      const positionFilter = createTenantFilter(tenantId, {}, true);
      const positionDeleteResult = await positionCollection.deleteMany(positionFilter);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'positions_delete_all',
        'position',
        {
          resourceId: 'all',
          metadata: {
            positionsDeleted: positionDeleteResult.deletedCount,
            assignmentsDeleted: assignmentDeleteResult.deletedCount,
            totalPositions: allPositions.length,
            totalAssignments: allAssignments.length,
          },
        }
      );

      return NextResponse.json({
        success: true,
        message: 'All positions deleted successfully',
        deleted: {
          positions: positionDeleteResult.deletedCount,
          assignments: assignmentDeleteResult.deletedCount,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Delete All Positions]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.CONFIG_WRITE }
);
