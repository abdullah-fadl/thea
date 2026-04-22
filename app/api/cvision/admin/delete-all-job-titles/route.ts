import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Admin API - Delete All Job Titles
 * DELETE /api/cvision/admin/delete-all-job-titles
 * 
 * WARNING: This deletes ALL job titles for the tenant.
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
import type { CVisionJobTitle } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// DELETE - Delete all job titles
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
          { error: 'Only OWNER can delete all job titles' },
          { status: 403 }
        );
      }

      const collection = await getCVisionCollection<CVisionJobTitle>(
        tenantId,
        'jobTitles'
      );

      // Get all job titles before deletion for audit
      const allJobTitles = await collection
        .find(createTenantFilter(tenantId, {}, true)) // Include archived
        .toArray();

      // Delete all job titles
      const filter = createTenantFilter(tenantId, {}, true);
      const deleteResult = await collection.deleteMany(filter);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'job_titles_delete_all',
        'job_title',
        {
          resourceId: 'all',
          metadata: {
            jobTitlesDeleted: deleteResult.deletedCount,
            totalJobTitles: allJobTitles.length,
          },
        }
      );

      return NextResponse.json({
        success: true,
        message: 'All job titles deleted successfully',
        deleted: {
          jobTitles: deleteResult.deletedCount,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Delete All Job Titles]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.CONFIG_WRITE }
);
