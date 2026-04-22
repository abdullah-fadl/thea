import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Admin API - Delete All Grades
 * DELETE /api/cvision/admin/delete-all-grades
 * 
 * WARNING: This deletes ALL grades for the tenant.
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
import type { CVisionGrade } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// DELETE - Delete all grades
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
          { error: 'Only OWNER can delete all grades' },
          { status: 403 }
        );
      }

      const collection = await getCVisionCollection<CVisionGrade>(
        tenantId,
        'grades'
      );

      // Get all grades before deletion for audit
      const allGrades = await collection
        .find(createTenantFilter(tenantId, {}, true)) // Include archived
        .toArray();

      // Delete all grades
      const filter = createTenantFilter(tenantId, {}, true);
      const deleteResult = await collection.deleteMany(filter);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'grades_delete_all',
        'grade',
        {
          resourceId: 'all',
          metadata: {
            gradesDeleted: deleteResult.deletedCount,
            totalGrades: allGrades.length,
          },
        }
      );

      return NextResponse.json({
        success: true,
        message: 'All grades deleted successfully',
        deleted: {
          grades: deleteResult.deletedCount,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Delete All Grades]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.CONFIG_WRITE }
);
