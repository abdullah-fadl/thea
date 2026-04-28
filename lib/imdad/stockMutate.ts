/**
 * Imdad Stock Mutation
 *
 * Atomic stock-level adjustment with transaction logging.
 * Used by GRN completion, inventory transactions, and adjustments.
 */

import { prisma } from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StockMutateParams {
  tenantId: string;
  organizationId: string;
  itemId: string;
  locationId: string;
  delta: number; // positive = increase, negative = decrease
  reason: string;
  userId: string;
  referenceType?: string;
  referenceId?: string;
  batchNumber?: string;
  expiryDate?: string | Date;
}

interface StockMutateResult {
  success: boolean;
  newQuantity?: number;
  transactionId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Atomically adjust stock level for an item at a location
 * and create an inventory transaction record.
 */
export async function stockMutate(params: StockMutateParams): Promise<StockMutateResult> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find or create stock level record
      let stockLevel = await (tx as any).imdadStockLevel.findFirst({
        where: {
          tenantId: params.tenantId,
          itemId: params.itemId,
          locationId: params.locationId,
          isDeleted: false,
        },
      });

      const previousQty = stockLevel?.quantityOnHand ?? 0;
      const newQty = previousQty + params.delta;

      if (newQty < 0) {
        throw new Error(`Insufficient stock: current ${previousQty}, requested delta ${params.delta}`);
      }

      if (stockLevel) {
        stockLevel = await (tx as any).imdadStockLevel.update({
          where: { id: stockLevel.id },
          data: {
            quantityOnHand: newQty,
            lastMovementDate: new Date(),
            version: { increment: 1 },
          },
        });
      } else {
        stockLevel = await (tx as any).imdadStockLevel.create({
          data: {
            tenantId: params.tenantId,
            organizationId: params.organizationId,
            itemId: params.itemId,
            locationId: params.locationId,
            quantityOnHand: newQty,
            quantityReserved: 0,
            quantityOnOrder: 0,
            lastMovementDate: new Date(),
          },
        });
      }

      // Create inventory transaction record
      const transaction = await tx.imdadInventoryTransaction.create({
        data: {
          tenantId: params.tenantId,
          organizationId: params.organizationId,
          itemId: params.itemId,
          locationId: params.locationId,
          movementType: params.delta > 0 ? 'IN' : 'OUT' as any,
          quantity: Math.abs(params.delta),
          previousQuantity: previousQty,
          newQuantity: newQty,
          reason: params.reason,
          referenceType: params.referenceType || null,
          referenceId: params.referenceId || null,
          batchNumber: params.batchNumber || null,
          performedBy: params.userId,
        } as any,
      });

      return { newQuantity: newQty, transactionId: transaction.id };
    });

    return {
      success: true,
      newQuantity: result.newQuantity,
      transactionId: result.transactionId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown stock mutation error';
    console.error('[IMDAD_STOCK] Mutation failed:', message);
    return { success: false, error: message };
  }
}
