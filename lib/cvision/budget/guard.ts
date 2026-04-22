/**
 * Budget Guard (PR-D: Budget v1)
 * 
 * Prevents creating/opening requisitions when no budget slots are available.
 */

import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import type { CVisionBudgetedPosition, CVisionEmployee, CVisionJobRequisition } from '@/lib/cvision/types';

/**
 * Compute available slots for a budgeted position
 */
export async function computeAvailableSlots(
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

  const budgetedHeadcount = position.budgetedHeadcount || 0;
  const availableSlots = Math.max(0, budgetedHeadcount - occupiedCount - openReqsCount);

  return availableSlots;
}

/**
 * Check if a requisition can be created/opened for a position
 * Returns { allowed: boolean, availableSlots: number, reason?: string }
 */
export async function checkBudgetSlot(
  tenantId: string,
  positionId: string | null | undefined,
  headcount: number = 1
): Promise<{
  allowed: boolean;
  availableSlots: number;
  reason?: string;
}> {
  // If no positionId, allow (backward compatibility)
  if (!positionId) {
    return {
      allowed: true,
      availableSlots: Infinity,
    };
  }

  const availableSlots = await computeAvailableSlots(tenantId, positionId);

  if (availableSlots < headcount) {
    const counts = await getOccupiedAndOpenCount(tenantId, positionId);
    const positionCollection = await getCVisionCollection<CVisionBudgetedPosition>(
      tenantId,
      'budgetedPositions'
    );
    const position = await positionCollection.findOne(
      createTenantFilter(tenantId, { id: positionId })
    );
    const budgeted = position?.budgetedHeadcount || 0;
    return {
      allowed: false,
      availableSlots,
      reason: `No available slots for this position. Budgeted: ${budgeted}, Occupied: ${counts.occupied}, Open Requisitions: ${counts.open}, Available: ${availableSlots}, Required: ${headcount}`,
    };
  }

  return {
    allowed: true,
    availableSlots,
  };
}

/**
 * Helper to get occupied and open counts (for error messages)
 */
async function getOccupiedAndOpenCount(
  tenantId: string,
  positionId: string
): Promise<{ occupied: number; open: number }> {
  const employeeCollection = await getCVisionCollection<CVisionEmployee>(
    tenantId,
    'employees'
  );
  
  const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
    tenantId,
    'jobRequisitions'
  );

  const occupied = await employeeCollection.countDocuments(
    createTenantFilter(tenantId, {
      positionId,
      status: { $in: ['ACTIVE', 'PROBATION'] },
      isArchived: { $ne: true },
    })
  );

  const open = await requisitionCollection.countDocuments(
    createTenantFilter(tenantId, {
      positionId,
      status: 'open',
      isArchived: { $ne: true },
    })
  );

  return { occupied, open };
}
