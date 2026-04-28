import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Position API
 * PATCH /api/cvision/positions/:id - Update position
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
import type { CVisionPositionType } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canWriteEmployee } from '@/lib/cvision/authz/policy';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updatePositionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

// PATCH - Update position
export const PATCH = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Position ID is required' },
          { status: 400 }
        );
      }

      // Enforce write policy (OWNER override handled in enforce)
      const writePolicy = canWriteEmployee(ctx, { tenantId } as any);
      const writeEnforceResult = await enforce(writePolicy, request, ctx);
      if (writeEnforceResult) {
        return writeEnforceResult; // 403
      }

      const body = await request.json();
      const data = updatePositionSchema.parse(body);

      const collection = await getCVisionCollection<CVisionPositionType>(
        tenantId,
        'positionTypes'
      );

      const position = await findById(collection, tenantId, id);
      if (!position) {
        return NextResponse.json(
          { error: 'Position not found' },
          { status: 404 }
        );
      }

      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: userId,
      };

      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        { $set: updateData }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'position_update',
        'position',
        {
          resourceId: id,
          changes: { before: position, after: { ...position, ...updateData } },
        }
      );

      const updated = await findById(collection, tenantId, id);

      return NextResponse.json({
        success: true,
        position: updated,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Position PATCH]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
