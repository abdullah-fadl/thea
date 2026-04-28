import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Request Escalation API
 * POST /api/cvision/requests/[id]/escalate - Escalate request (rule-based)
 * 
 * Escalation Rules:
 * 1. If SLA is breached (overdue), auto-escalate to next level
 * 2. If confidentiality is confidential/anonymous, must go to HR
 * 3. Escalation path: manager -> hr -> compliance
 * 4. Cannot escalate from compliance (terminal)
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
import { escalateRequestSchema } from '@/lib/cvision/validation';
import {
  CVISION_PERMISSIONS,
  REQUEST_STATUS_TRANSITIONS,
  ESCALATION_PATH,
} from '@/lib/cvision/constants';
import type { CVisionRequest, CVisionRequestEvent, RequestOwnerRole } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Determine if escalation is allowed and to which role
 */
function determineEscalation(request: CVisionRequest): {
  canEscalate: boolean;
  nextOwnerRole: RequestOwnerRole | null;
  reason: string;
  isAutoEscalation: boolean;
} {
  const currentOwner = request.currentOwnerRole;
  const nextRole = ESCALATION_PATH[currentOwner] as RequestOwnerRole | null;

  // Cannot escalate from compliance (terminal)
  if (!nextRole) {
    return {
      canEscalate: false,
      nextOwnerRole: null,
      reason: `Cannot escalate further. Request is already at ${currentOwner} level.`,
      isAutoEscalation: false,
    };
  }

  // Check if SLA is breached
  const now = new Date();
  const isOverdue = request.slaDueAt && new Date(request.slaDueAt) < now;
  
  if (isOverdue) {
    return {
      canEscalate: true,
      nextOwnerRole: nextRole,
      reason: `SLA breached. Auto-escalating from ${currentOwner} to ${nextRole}.`,
      isAutoEscalation: true,
    };
  }

  // Confidential/anonymous requests should be at HR or compliance
  if (
    (request.confidentiality === 'confidential' || request.confidentiality === 'anonymous') &&
    currentOwner === 'manager'
  ) {
    return {
      canEscalate: true,
      nextOwnerRole: 'hr',
      reason: `${request.confidentiality} request requires HR handling.`,
      isAutoEscalation: true,
    };
  }

  // Manual escalation allowed
  return {
    canEscalate: true,
    nextOwnerRole: nextRole,
    reason: `Manual escalation from ${currentOwner} to ${nextRole}.`,
    isAutoEscalation: false,
  };
}

// POST - Escalate request
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
      const data = escalateRequestSchema.parse(body);

      const collection = await getCVisionCollection<CVisionRequest>(
        tenantId,
        'requests'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }

      // Check if request can be escalated from current status
      if (existing.status === 'closed' || existing.status === 'approved' || existing.status === 'rejected') {
        return NextResponse.json(
          {
            error: 'Cannot escalate request',
            message: `Request is ${existing.status} and cannot be escalated.`,
          },
          { status: 400 }
        );
      }

      // Determine escalation rules
      const escalationResult = determineEscalation(existing);

      if (!escalationResult.canEscalate && !data.forceEscalation) {
        return NextResponse.json(
          {
            error: 'Cannot escalate request',
            message: escalationResult.reason,
          },
          { status: 400 }
        );
      }

      const now = new Date();
      const previousOwnerRole = existing.currentOwnerRole;
      const nextOwnerRole = escalationResult.nextOwnerRole || 'compliance';

      // Check if SLA is now breached
      const isOverdue = existing.slaDueAt && new Date(existing.slaDueAt) < now;

      // Update request
      const updateData: Partial<CVisionRequest> = {
        status: 'escalated',
        statusChangedAt: now,
        currentOwnerRole: nextOwnerRole,
        escalatedAt: now,
        escalationReason: data.reason,
        escalatedFromRole: previousOwnerRole,
        slaBreached: isOverdue || existing.slaBreached,
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

      const escalateEvent: CVisionRequestEvent = {
        id: uuidv4(),
        tenantId,
        requestId: id,
        actorUserId: userId,
        actorRole: role,
        eventType: 'escalated',
        payloadJson: {
          previousOwnerRole,
          newOwnerRole: nextOwnerRole,
          reason: data.reason,
          systemReason: escalationResult.reason,
          isAutoEscalation: escalationResult.isAutoEscalation,
          slaBreached: isOverdue,
        },
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await eventCollection.insertOne(escalateEvent);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'request_escalate',
        'request',
        {
          resourceId: id,
          changes: {
            before: { status: existing.status, currentOwnerRole: previousOwnerRole },
            after: { status: 'escalated', currentOwnerRole: nextOwnerRole },
          },
          metadata: {
            reason: data.reason,
            isAutoEscalation: escalationResult.isAutoEscalation,
            slaBreached: isOverdue,
          },
        }
      );

      const updated = await findById(collection, tenantId, id);

      return NextResponse.json({
        success: true,
        request: updated,
        event: escalateEvent,
        escalationInfo: {
          previousOwnerRole,
          newOwnerRole: nextOwnerRole,
          isAutoEscalation: escalationResult.isAutoEscalation,
          systemReason: escalationResult.reason,
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Request Escalate POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.REQUESTS_ESCALATE }
);
