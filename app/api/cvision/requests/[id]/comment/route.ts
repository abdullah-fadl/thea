import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Request Comment API
 * POST /api/cvision/requests/[id]/comment - Add comment to request
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
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
import { commentRequestSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionRequest, CVisionRequestEvent } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Add comment to request
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Request ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = commentRequestSchema.parse(body);

      const collection = await getCVisionCollection<CVisionRequest>(
        tenantId,
        'requests'
      );

      const requestDoc = await findById(collection, tenantId, id);
      if (!requestDoc) {
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }

      // Check if request is closed
      if (requestDoc.status === 'closed') {
        return NextResponse.json(
          { error: 'Cannot add comment to closed request' },
          { status: 400 }
        );
      }

      const now = new Date();

      // Create event
      const eventCollection = await getCVisionCollection<CVisionRequestEvent>(
        tenantId,
        'requestEvents'
      );

      const commentEvent: CVisionRequestEvent = {
        id: uuidv4(),
        tenantId,
        requestId: id,
        actorUserId: userId,
        actorRole: role,
        eventType: 'comment',
        payloadJson: {
          content: data.content,
          isInternal: data.isInternal,
        },
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await eventCollection.insertOne(commentEvent);

      // Update request timestamp
      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        { $set: { updatedAt: now, updatedBy: userId } }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'request_update',
        'request',
        {
          resourceId: id,
          changes: {
            after: { comment: data.content, isInternal: data.isInternal },
          },
          metadata: { eventType: 'comment' },
        }
      );

      return NextResponse.json({
        success: true,
        event: commentEvent,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Request Comment POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.REQUESTS_WRITE }
);
