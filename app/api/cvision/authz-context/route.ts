import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Authz Context API (DEV-ONLY)
 * GET /api/cvision/authz-context - Get current authz context for debugging
 * 
 * Dev-only endpoint to inspect authorization context.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import { canEditProfileSection } from '@/lib/cvision/authz/policy';
import { CVISION_ROLES } from '@/lib/cvision/roles';
import { getCVisionCollection } from '@/lib/cvision/db';
import type { CVisionEmployee } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get authz context (dev only)
export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Not available in production' },
        { status: 403 }
      );
    }

    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      // Get a sample employee to compute permissions
      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );
      const sampleEmployee = await employeeCollection.findOne({ tenantId });

      // Compute permissions for each section
      const permissions: Record<string, boolean> = {};
      if (sampleEmployee) {
        permissions.canEditPersonal = canEditProfileSection(ctx, sampleEmployee, 'PERSONAL').allowed;
        permissions.canEditEmployment = canEditProfileSection(ctx, sampleEmployee, 'EMPLOYMENT').allowed;
        permissions.canEditFinancial = canEditProfileSection(ctx, sampleEmployee, 'FINANCIAL').allowed;
        permissions.canEditContract = canEditProfileSection(ctx, sampleEmployee, 'CONTRACT').allowed;
      }

      // Check if can change status (HR roles or OWNER)
      const canChangeStatus = ctx.roles.some(role =>
        role === CVISION_ROLES.OWNER ||
        role === CVISION_ROLES.CVISION_ADMIN ||
        role === CVISION_ROLES.HR_ADMIN ||
        role === CVISION_ROLES.HR_MANAGER
      );

      return NextResponse.json({
        success: true,
        context: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          roles: ctx.roles,
          employeeId: ctx.employeeId || null,
          departmentIds: ctx.departmentIds || [],
          employeeStatus: ctx.employeeStatus || null,
          isOwner: ctx.isOwner || false,
          hasOwnerRole: ctx.roles.includes(CVISION_ROLES.OWNER),
        },
        permissions: {
          ...permissions,
          canChangeStatus,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Authz Context GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.VIEW }
);
