import { logger } from '@/lib/monitoring/logger';
/**
 * CVision CV Inbox Batches API
 * GET /api/cvision/recruitment/cv-inbox/batches - List batches
 * POST /api/cvision/recruitment/cv-inbox/batches - Create batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  paginatedList,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { paginationSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionCvInboxBatch } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canAccessCvInbox } from '@/lib/cvision/authz/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List batches
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
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

      const { searchParams } = new URL(request.url);
      const params = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        search: searchParams.get('search'),
        sortBy: searchParams.get('sortBy') || 'createdAt',
        sortOrder: searchParams.get('sortOrder') || 'desc',
        includeDeleted: searchParams.get('includeDeleted'),
      });

      const collection = await getCVisionCollection<CVisionCvInboxBatch>(
        tenantId,
        'cvInboxBatches'
      );

      const result = await paginatedList(collection, tenantId, params);

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      logger.error('[CVision CV Inbox Batches GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);

// POST - Create batch
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
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

      const now = new Date();

      const batch: CVisionCvInboxBatch = {
        id: uuidv4(),
        tenantId,
        createdByUserId: userId,
        itemCount: 0,
        parsedCount: 0,
        suggestedCount: 0,
        assignedCount: 0,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      const collection = await getCVisionCollection<CVisionCvInboxBatch>(
        tenantId,
        'cvInboxBatches'
      );

      await collection.insertOne(batch);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'cv_inbox_batch_create',
        'cv_inbox_batch',
        {
          resourceId: batch.id,
          changes: {
            after: {
              batchId: batch.id,
              createdByUserId: userId,
            },
          },
        }
      );

      return NextResponse.json(
        {
          success: true,
          batch,
        },
        { status: 201 }
      );
    } catch (error: any) {
      logger.error('[CVision CV Inbox Batches POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
