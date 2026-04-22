import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Budgeted Position API (PR-D: Budget v1)
 * 
 * PATCH /api/cvision/org/budgeted-positions/:id - Update budgeted position
 * GET /api/cvision/org/budgeted-positions/:id - Get single budgeted position with metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canReadOrg, canWriteOrg } from '@/lib/cvision/authz/policy';
import { getCVisionCollection, createTenantFilter, findById } from '@/lib/cvision/db';
import type { CVisionBudgetedPosition, CVisionEmployee, CVisionJobRequisition } from '@/lib/cvision/types';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { updateBudgetedPositionSchema } from '@/lib/cvision/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Compute metrics for a budgeted position
 */
async function computePositionMetrics(
  tenantId: string,
  positionId: string
): Promise<{
  occupiedHeadcount: number;
  openRequisitions: number;
  availableSlots: number;
}> {
  const employeeCollection = await getCVisionCollection<CVisionEmployee>(
    tenantId,
    'employees'
  );
  
  const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
    tenantId,
    'jobRequisitions'
  );

  // Count occupied headcount (ACTIVE + PROBATION employees)
  const occupiedCount = await employeeCollection.countDocuments(
    createTenantFilter(tenantId, {
      positionId,
      status: { $in: ['ACTIVE', 'PROBATION'] },
      isArchived: { $ne: true },
    })
  );

  // Count open requisitions
  const openReqsCount = await requisitionCollection.countDocuments(
    createTenantFilter(tenantId, {
      positionId,
      status: 'open',
      isArchived: { $ne: true },
    })
  );

  // Get position to get budgetedHeadcount
  const positionCollection = await getCVisionCollection<CVisionBudgetedPosition>(
    tenantId,
    'budgetedPositions'
  );
  const position = await positionCollection.findOne(
    createTenantFilter(tenantId, { id: positionId })
  );

  const budgetedHeadcount = position?.budgetedHeadcount || 0;
  const availableSlots = Math.max(0, budgetedHeadcount - occupiedCount - openReqsCount);

  return {
    occupiedHeadcount: occupiedCount,
    openRequisitions: openReqsCount,
    availableSlots,
  };
}

// GET - Get single budgeted position with metrics
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult;
      }
      const ctx = ctxResult;

      // Enforce read permission
      const policyResult = canReadOrg(ctx);
      const enforceResult = await enforce(policyResult, request, ctx);
      if (enforceResult) {
        return enforceResult;
      }

      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Position ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionBudgetedPosition>(
        tenantId,
        'budgetedPositions'
      );

      const position = await findById(collection, tenantId, id);
      if (!position) {
        return NextResponse.json(
          { error: 'Budgeted position not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      // Compute metrics
      const metrics = await computePositionMetrics(tenantId, id);

      return NextResponse.json({
        success: true,
        position: {
          ...position,
          ...metrics,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Budgeted Position GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);

// PATCH - Update budgeted position
export const PATCH = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult;
      }
      const ctx = ctxResult;

      // Enforce write permission
      const policyResult = canWriteOrg(ctx);
      const enforceResult = await enforce(policyResult, request, ctx);
      if (enforceResult) {
        return enforceResult;
      }

      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Position ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = updateBudgetedPositionSchema.parse(body);

      const collection = await getCVisionCollection<CVisionBudgetedPosition>(
        tenantId,
        'budgetedPositions'
      );

      const position = await findById(collection, tenantId, id);
      if (!position) {
        return NextResponse.json(
          { error: 'Budgeted position not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      // Build update object
      const updateData: Partial<CVisionBudgetedPosition> = {
        updatedAt: new Date(),
        updatedBy: userId,
      };

      if (data.title !== undefined) {
        updateData.title = data.title;
      }
      if (data.budgetedHeadcount !== undefined) {
        updateData.budgetedHeadcount = data.budgetedHeadcount;
      }
      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        { $set: updateData }
      );

      // Get updated position
      const updatedPosition = await findById(collection, tenantId, id);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'budgeted_position_update',
        'budgeted_position',
        {
          resourceId: id,
          changes: {
            before: position,
            after: updateData,
          },
        }
      );

      // Compute metrics for response
      const metrics = await computePositionMetrics(tenantId, id);

      return NextResponse.json({
        success: true,
        position: {
          ...updatedPosition,
          ...metrics,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Budgeted Position PATCH]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_WRITE }
);
