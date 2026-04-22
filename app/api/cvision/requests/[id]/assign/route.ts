import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Request Assign API
 * POST /api/cvision/requests/[id]/assign - Assign request (HR roles only)
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
import { assignRequestSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionRequest, CVisionRequestEvent, RequestOwnerRole } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Roles allowed to assign requests
const ASSIGN_ROLES = ['admin', 'thea-owner', 'hr-manager', 'hr_admin', 'hr_specialist'];

// POST - Assign request
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

      // Check if user has permission to assign
      if (!ASSIGN_ROLES.includes(role)) {
        return NextResponse.json(
          { error: 'Only HR roles can assign requests' },
          { status: 403 }
        );
      }

      const body = await request.json();
      const data = assignRequestSchema.parse(body);

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
          { error: 'Cannot assign closed request' },
          { status: 400 }
        );
      }

      const now = new Date();
      const previousAssignee = requestDoc.assignedToUserId;
      const previousRole = requestDoc.assignedToRole;

      // Update request
      const updateData: Partial<CVisionRequest> = {
        assignedToUserId: data.assignToUserId,
        assignedToRole: data.assignToRole as RequestOwnerRole,
        assignedAt: now,
        currentOwnerRole: data.assignToRole as RequestOwnerRole,
        status: requestDoc.status === 'open' ? 'in_review' : requestDoc.status,
        statusChangedAt: requestDoc.status === 'open' ? now : requestDoc.statusChangedAt,
        updatedAt: now,
        updatedBy: userId,
      };

      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        { $set: updateData }
      );

      // Create event
      const eventCollection = await getCVisionCollection<CVisionRequestEvent>(
        tenantId,
        'requestEvents'
      );

      const assignEvent: CVisionRequestEvent = {
        id: uuidv4(),
        tenantId,
        requestId: id,
        actorUserId: userId,
        actorRole: role,
        eventType: 'assigned',
        payloadJson: {
          assignedToUserId: data.assignToUserId,
          assignedToRole: data.assignToRole,
          previousAssignee,
          previousRole,
          notes: data.notes,
        },
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await eventCollection.insertOne(assignEvent);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'request_update',
        'request',
        {
          resourceId: id,
          changes: {
            before: { assignedToUserId: previousAssignee, assignedToRole: previousRole },
            after: { assignedToUserId: data.assignToUserId, assignedToRole: data.assignToRole },
          },
          metadata: { eventType: 'assigned' },
        }
      );

      const updated = await findById(collection, tenantId, id);

      return NextResponse.json({
        success: true,
        request: updated,
        event: assignEvent,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Request Assign POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.REQUESTS_WRITE }
);
