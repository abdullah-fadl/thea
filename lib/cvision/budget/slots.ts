/**
 * Position Slot Budget Logic (PR-B: Position Lifecycle)
 * 
 * Computes available slots using PositionSlots lifecycle.
 */

import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import type { CVisionBudgetedPosition, CVisionPositionSlot } from '@/lib/cvision/types';

/**
 * Compute available slots for a budgeted position using PositionSlots
 * Available = budgetedHeadcount - (FILLED slots) - (VACANT slots from open requisitions)
 */
export async function computeAvailableSlotsFromSlots(
  tenantId: string,
  positionId: string
): Promise<number> {
  const positionCollection = await getCVisionCollection<CVisionBudgetedPosition>(
    tenantId,
    'budgetedPositions'
  );
  
  const position = await positionCollection.findOne(
    createTenantFilter(tenantId, { id: positionId })
  );

  if (!position) {
    return 0; // Position doesn't exist
  }

  const slotCollection = await getCVisionCollection<CVisionPositionSlot>(
    tenantId,
    'positionSlots'
  );

  // Count FILLED slots (occupied)
  const filledCount = await slotCollection.countDocuments(
    createTenantFilter(tenantId, {
      positionId,
      status: 'FILLED',
    })
  );

  // Count VACANT slots from open requisitions (reserved)
  const vacantFromOpenReqs = await slotCollection.countDocuments({
    tenantId,
    positionId,
    status: 'VACANT',
    requisitionId: { $exists: true, $ne: null },
  });

  const budgetedHeadcount = position.budgetedHeadcount || 0;
  const availableSlots = Math.max(0, budgetedHeadcount - filledCount - vacantFromOpenReqs);

  return availableSlots;
}

/**
 * Check if we can create N slots for a position
 */
export async function checkSlotCapacity(
  tenantId: string,
  positionId: string,
  requestedSlots: number
): Promise<{
  allowed: boolean;
  availableSlots: number;
  reason?: string;
}> {
  const availableSlots = await computeAvailableSlotsFromSlots(tenantId, positionId);

  if (availableSlots < requestedSlots) {
    const positionCollection = await getCVisionCollection<CVisionBudgetedPosition>(
      tenantId,
      'budgetedPositions'
    );
    const position = await positionCollection.findOne(
      createTenantFilter(tenantId, { id: positionId })
    );
    const budgeted = position?.budgetedHeadcount || 0;
    
    const slotCollection = await getCVisionCollection<CVisionPositionSlot>(
      tenantId,
      'positionSlots'
    );
    const filled = await slotCollection.countDocuments(
      createTenantFilter(tenantId, { positionId, status: 'FILLED' })
    );
    const vacant = await slotCollection.countDocuments({
      tenantId,
      positionId,
      status: 'VACANT',
      requisitionId: { $exists: true, $ne: null },
    });

    return {
      allowed: false,
      availableSlots,
      reason: `No available slots for this position. Budgeted: ${budgeted}, Filled: ${filled}, Vacant (Open Reqs): ${vacant}, Available: ${availableSlots}, Required: ${requestedSlots}`,
    };
  }

  return {
    allowed: true,
    availableSlots,
  };
}
