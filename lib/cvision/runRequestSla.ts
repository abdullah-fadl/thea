import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Request SLA Runner
 * 
 * Checks for overdue requests and auto-escalates them based on escalation rules.
 * Similar to Patient Experience SLA runner pattern.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import type { CVisionRequest, RequestOwnerRole, CVisionRequestEvent } from '@/lib/cvision/types';
import { ESCALATION_PATH } from '@/lib/cvision/constants';

export interface RunRequestSlaResult {
  scanned: number;
  escalated: number;
  skipped: number;
  errors?: string[];
}

/**
 * Run SLA check for CVision requests
 * Finds overdue requests and auto-escalates them
 */
export async function runRequestSla(actorUserId?: string): Promise<RunRequestSlaResult> {
  const result: RunRequestSlaResult = {
    scanned: 0,
    escalated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Get all tenant databases (would need tenant registry)
    // For now, we'll need to pass tenantId or iterate through tenants
    // This is a simplified version - in production, you'd iterate through all tenants
    
    // Note: This function needs tenant context
    // For cron jobs, we'd need to iterate through all active tenants
    logger.info('[CVision Request SLA] SLA check requires tenant context - use runRequestSlaForTenant');
    
    return result;
  } catch (error: any) {
    logger.error('[CVision Request SLA] Error:', error);
    result.errors = result.errors || [];
    result.errors.push(error.message || String(error));
    return result;
  }
}

/**
 * Run SLA check for a specific tenant
 */
export async function runRequestSlaForTenant(
  tenantId: string,
  actorUserId?: string
): Promise<RunRequestSlaResult> {
  const result: RunRequestSlaResult = {
    scanned: 0,
    escalated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const collection = await getCVisionCollection<CVisionRequest>(
      tenantId,
      'requests'
    );

    const now = new Date();

    // Find all open/in_review/escalated requests that are overdue
    const overdueRequests = await collection
      .find(
        createTenantFilter(tenantId, {
          status: { $in: ['open', 'in_review', 'escalated'] },
          slaDueAt: { $lt: now },
          slaBreached: { $ne: true }, // Only process not-yet-marked-as-breached
          isArchived: { $ne: true },
        })
      )
      .toArray();

    result.scanned = overdueRequests.length;

    for (const request of overdueRequests) {
      try {
        // Check if escalation is possible
        const currentOwner = request.currentOwnerRole;
        const nextRole = ESCALATION_PATH[currentOwner] as RequestOwnerRole | null;

        if (!nextRole) {
          // Cannot escalate further - just mark as breached
          await collection.updateOne(
            createTenantFilter(tenantId, { id: request.id }),
            {
              $set: {
                slaBreached: true,
                updatedAt: now,
                updatedBy: actorUserId || 'system-sla',
              },
            }
          );
          result.skipped++;
          continue;
        }

        // Auto-escalate
        await collection.updateOne(
          createTenantFilter(tenantId, { id: request.id }),
          {
            $set: {
              status: 'escalated',
              statusChangedAt: now,
              currentOwnerRole: nextRole,
              escalatedAt: now,
              escalationReason: `SLA breached. Auto-escalated from ${currentOwner} to ${nextRole}.`,
              escalatedFromRole: currentOwner,
              slaBreached: true,
              updatedAt: now,
              updatedBy: actorUserId || 'system-sla',
            },
          }
        );

        // Create escalation event
        const eventCollection = await getCVisionCollection<CVisionRequestEvent>(
          tenantId,
          'requestEvents'
        );

        await eventCollection.insertOne({
          id: uuidv4(),
          tenantId,
          requestId: request.id,
          actorUserId: actorUserId || 'system-sla',
          actorRole: 'system',
          eventType: 'escalated',
          payloadJson: {
            previousOwnerRole: currentOwner,
            newOwnerRole: nextRole,
            reason: `SLA breached. Auto-escalated from ${currentOwner} to ${nextRole}.`,
            isAutoEscalation: true,
            slaBreached: true,
          },
          createdAt: now,
          updatedAt: now,
          createdBy: actorUserId || 'system-sla',
          updatedBy: actorUserId || 'system-sla',
        });

        result.escalated++;
      } catch (error: any) {
        logger.error(`[CVision Request SLA] Error processing request ${request.id}:`, error);
        result.errors = result.errors || [];
        result.errors.push(`Request ${request.id}: ${error.message || String(error)}`);
      }
    }

    return result;
  } catch (error: any) {
    logger.error('[CVision Request SLA] Error:', error);
    result.errors = result.errors || [];
    result.errors.push(error.message || String(error));
    return result;
  }
}
