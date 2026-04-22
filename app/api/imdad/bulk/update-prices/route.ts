/**
 * SCM Bulk — Batch Update Item Prices
 *
 * POST /api/imdad/bulk/update-prices
 * Body: { updates: { itemId, standardCost?, lastPurchaseCost? }[], reason: string }
 * Returns: { updated: number, failed: { id: string, reason: string }[] }
 *
 * Audit logs old/new values for each price change.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

export const dynamic = 'force-dynamic';

const priceUpdateSchema = z.object({
  itemId: z.string().uuid(),
  standardCost: z.number().nonnegative().optional(),
  lastPurchaseCost: z.number().nonnegative().optional(),
}).refine(
  (data) => data.standardCost !== undefined || data.lastPurchaseCost !== undefined,
  { message: 'At least one of standardCost or lastPurchaseCost must be provided' }
);

const bulkUpdatePricesSchema = z.object({
  updates: z
    .array(priceUpdateSchema)
    .min(1, 'At least one update is required')
    .max(500, 'Maximum 500 updates per batch'),
  reason: z.string().min(1, 'Reason is required'),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = bulkUpdatePricesSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { updates, reason } = parsed.data;
      let updated = 0;
      const failed: { id: string; reason: string }[] = [];

      // Pre-fetch all referenced items
      const itemIds = [...new Set(updates.map((u) => u.itemId))];
      const existingItems = await prisma.imdadItemMaster.findMany({
        where: {
          tenantId,
          id: { in: itemIds },
          isDeleted: false,
        },
        select: {
          id: true,
          code: true,
          organizationId: true,
          standardCost: true,
          lastPurchaseCost: true,
        },
      });

      const itemMap = new Map((existingItems as any[]).map((item) => [item.id, item]));

      // Separate valid from invalid updates
      const validUpdates: { update: typeof updates[0]; item: any }[] = [];
      for (const update of updates) {
        const item = itemMap.get(update.itemId);
        if (!item) {
          failed.push({ id: update.itemId, reason: 'Item not found' });
        } else {
          validUpdates.push({ update, item });
        }
      }

      // Batch all valid updates in a single transaction
      if (validUpdates.length > 0) {
        try {
          await prisma.$transaction(
            validUpdates.map(({ update, item }) => {
              const updateData: Record<string, any> = { updatedBy: userId };
              if (update.standardCost !== undefined) updateData.standardCost = update.standardCost;
              if (update.lastPurchaseCost !== undefined) updateData.lastPurchaseCost = update.lastPurchaseCost;

              return prisma.imdadItemMaster.update({
                where: { id: update.itemId },
                data: updateData,
              });
            }),
          );
          updated = validUpdates.length;
        } catch (batchError) {
          // If batch fails, fall back to individual updates to identify which ones fail
          for (const { update, item } of validUpdates) {
            try {
              const updateData: Record<string, any> = { updatedBy: userId };
              if (update.standardCost !== undefined) updateData.standardCost = update.standardCost;
              if (update.lastPurchaseCost !== undefined) updateData.lastPurchaseCost = update.lastPurchaseCost;

              await prisma.imdadItemMaster.update({
                where: { id: update.itemId },
                data: updateData,
              });
              updated++;
            } catch {
              failed.push({ id: update.itemId, reason: `Failed to update item ${item.code}` });
            }
          }
        }

        // Batch audit logging after successful updates
        for (const { update, item } of validUpdates) {
          const oldValues: Record<string, any> = {};
          const newValues: Record<string, any> = {};
          if (update.standardCost !== undefined) {
            oldValues.standardCost = item.standardCost?.toString() ?? null;
            newValues.standardCost = update.standardCost;
          }
          if (update.lastPurchaseCost !== undefined) {
            oldValues.lastPurchaseCost = item.lastPurchaseCost?.toString() ?? null;
            newValues.lastPurchaseCost = update.lastPurchaseCost;
          }

          await imdadAudit.log({
            tenantId,
            organizationId: item.organizationId ?? undefined,
            actorUserId: userId,
            actorRole: role,
            action: 'UPDATE',
            resourceType: 'item_master',
            resourceId: item.id,
            boundedContext: 'BC1_INVENTORY',
            previousData: { ...oldValues, reason },
            newData: { ...newValues, reason },
            request: req,
          });
        }
      }

      return NextResponse.json({ updated, failed });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.items.update' }
);
