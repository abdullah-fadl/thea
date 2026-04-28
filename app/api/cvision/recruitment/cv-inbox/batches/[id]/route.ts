import { logger } from '@/lib/monitoring/logger';
/**
 * CVision CV Inbox Batch by ID API
 * GET /api/cvision/recruitment/cv-inbox/batches/:id - Get batch with items
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionCvInboxBatch, CVisionCvInboxItem } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canAccessCvInbox } from '@/lib/cvision/authz/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get batch with items
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      // Check permission (HR roles only - CV Inbox access)
      const cvInboxPolicy = canAccessCvInbox(ctx);
      const enforceResult = await enforce(cvInboxPolicy, request, ctx);
      if (enforceResult) {
        return enforceResult; // 403
      }

      const resolvedParams = await params;
      const batchId = resolvedParams?.id as string;

      if (!batchId) {
        return NextResponse.json(
          { error: 'Batch ID is required' },
          { status: 400 }
        );
      }

      const batchCollection = await getCVisionCollection<CVisionCvInboxBatch>(
        tenantId,
        'cvInboxBatches'
      );
      const batch = await findById(batchCollection, tenantId, batchId);

      if (!batch) {
        return NextResponse.json(
          { error: 'Batch not found' },
          { status: 404 }
        );
      }

      // Get all items in batch
      const itemCollection = await getCVisionCollection<CVisionCvInboxItem>(
        tenantId,
        'cvInboxItems'
      );
      const items = await itemCollection
        .find(createTenantFilter(tenantId, { batchId }))
        .sort({ createdAt: 1 })
        .toArray();

      return NextResponse.json({
        success: true,
        batch,
        items,
      });
    } catch (error: any) {
      logger.error('[CVision CV Inbox Batch GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);
