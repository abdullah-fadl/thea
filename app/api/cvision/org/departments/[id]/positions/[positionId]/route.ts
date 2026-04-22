import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Department Position API
 * DELETE /api/cvision/org/departments/:id/positions/:positionId - Remove position from department
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionDepartmentPosition, CVisionEmployee } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canWriteEmployee } from '@/lib/cvision/authz/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// DELETE - Remove position from department
export const DELETE = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult;
      }
      const ctx = ctxResult;

      // Enforce write policy
      const writePolicy = canWriteEmployee(ctx, { tenantId } as unknown as CVisionEmployee);
      const writeEnforceResult = await enforce(writePolicy, request, ctx);
      if (writeEnforceResult) {
        return writeEnforceResult;
      }

      // Resolve params (withAuthTenant may pass Promise in Next.js 15)
      const resolvedParams = params instanceof Promise ? await params : params;
      const departmentId = resolvedParams?.id as string;
      const positionId = resolvedParams?.positionId as string;

      if (!departmentId || !positionId) {
        return NextResponse.json(
          { error: 'Department ID and Position ID are required' },
          { status: 400 }
        );
      }

      const assignmentCollection = await getCVisionCollection<CVisionDepartmentPosition>(
        tenantId,
        'departmentPositions'
      );

      const assignment = await assignmentCollection.findOne(
        createTenantFilter(tenantId, {
          departmentId,
          positionId,
        })
      );

      if (!assignment) {
        return NextResponse.json(
          { error: 'Position assignment not found' },
          { status: 404 }
        );
      }

      // Soft delete by setting isActive=false
      await assignmentCollection.updateOne(
        createTenantFilter(tenantId, { id: assignment.id }),
        {
          $set: {
            isActive: false,
            updatedAt: new Date(),
            updatedBy: userId,
          },
        }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'department_position_remove',
        'department_position',
        {
          resourceId: assignment.id,
          changes: {
            before: assignment,
            after: { ...assignment, isActive: false },
          },
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Position removed from department',
      });
    } catch (error: any) {
      logger.error('[CVision Department Position DELETE]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
