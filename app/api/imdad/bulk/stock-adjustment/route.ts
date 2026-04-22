/**
 * SCM Bulk — Batch Stock Adjustments
 *
 * POST /api/imdad/bulk/stock-adjustment
 * Body: { adjustments: { itemId, locationId, quantityChange, reason, notes? }[] }
 * Returns: { created: number, failed: { index: number, reason: string }[] }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

export const dynamic = 'force-dynamic';

const adjustmentItemSchema = z.object({
  itemId: z.string().uuid(),
  locationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  quantityChange: z.number().int({ message: 'quantityChange must be an integer' }),
  reason: z.enum([
    'PHYSICAL_COUNT',
    'DAMAGE',
    'EXPIRY',
    'THEFT',
    'SYSTEM_CORRECTION',
    'RETURN',
    'DONATION',
    'SAMPLE',
    'TRANSFER_CORRECTION',
    'OTHER',
  ]),
  reasonDetail: z.string().optional(),
  notes: z.string().optional(),
});

const bulkStockAdjustmentSchema = z.object({
  adjustments: z
    .array(adjustmentItemSchema)
    .min(1, 'At least one adjustment is required')
    .max(200, 'Maximum 200 adjustments per batch'),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = bulkStockAdjustmentSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { adjustments } = parsed.data;
      const now = new Date();
      let created = 0;
      const failed: { index: number; reason: string }[] = [];

      // Pre-fetch all referenced items and locations for validation
      const itemIds = [...new Set(adjustments.map((a) => a.itemId))];
      const locationIds = [...new Set(adjustments.map((a) => a.locationId))];

      const [items, locations] = await Promise.all([
        prisma.imdadItemMaster.findMany({
          where: { tenantId, id: { in: itemIds }, isDeleted: false },
          select: { id: true },
        }),
        prisma.imdadInventoryLocation.findMany({
          where: { tenantId, id: { in: locationIds }, isDeleted: false },
          select: { id: true },
        }),
      ]);

      const validItemIds = new Set(items.map((i) => i.id));
      const validLocationIds = new Set(locations.map((l) => l.id));

      // Validate all adjustments upfront and separate valid from invalid
      const validAdjustments: { index: number; adj: typeof adjustments[0] }[] = [];
      for (let i = 0; i < adjustments.length; i++) {
        const adj = adjustments[i];
        if (!validItemIds.has(adj.itemId)) {
          failed.push({ index: i, reason: `Item ${adj.itemId} not found` });
        } else if (!validLocationIds.has(adj.locationId)) {
          failed.push({ index: i, reason: `Location ${adj.locationId} not found` });
        } else {
          validAdjustments.push({ index: i, adj });
        }
      }

      // Process all valid adjustments in a single transaction
      if (validAdjustments.length > 0) {
        try {
          const results = await prisma.$transaction(async (tx) => {
            const createdAdjustments: { index: number; adj: typeof adjustments[0]; adjustment: any; previousStock: number; newStock: number; adjustmentNumber: string }[] = [];

            for (const { index: i, adj } of validAdjustments) {
              // Get current stock level at this item-location
              const itemLocation = await tx.imdadItemLocation.findFirst({
                where: {
                  tenantId,
                  organizationId: adj.organizationId,
                  itemId: adj.itemId,
                  locationId: adj.locationId,
                  isDeleted: false,
                },
                select: { currentStock: true },
              });

              const previousStock = itemLocation?.currentStock ?? 0;
              const newStock = previousStock + adj.quantityChange;

              if (newStock < 0) {
                failed.push({
                  index: i,
                  reason: `Adjustment would result in negative stock (current: ${previousStock}, change: ${adj.quantityChange})`,
                });
                continue;
              }

              // Generate adjustment number atomically
              const counter = await tx.imdadSequenceCounter.upsert({
                where: {
                  tenantId_organizationId_sequenceType_fiscalYear: {
                    tenantId,
                    organizationId: adj.organizationId,
                    sequenceType: 'ADJ',
                    fiscalYear: now.getFullYear(),
                  },
                },
                create: {
                  tenantId,
                  organizationId: adj.organizationId,
                  sequenceType: 'ADJ',
                  prefix: 'ADJ-',
                  currentValue: 1,
                  fiscalYear: now.getFullYear(),
                } as any,
                update: {
                  currentValue: { increment: 1 },
                },
              });

              const adjustmentNumber = `${counter.prefix}${now.getFullYear()}-${String(counter.currentValue).padStart(counter.padLength, '0')}`;

              const adjustment = await tx.imdadInventoryAdjustment.create({
                data: {
                  tenantId,
                  organizationId: adj.organizationId,
                  adjustmentNumber,
                  itemId: adj.itemId,
                  locationId: adj.locationId,
                  reason: adj.reason,
                  reasonDetail: adj.reasonDetail,
                  quantityChange: adj.quantityChange,
                  previousStock,
                  newStock,
                  status: 'PENDING',
                  requestedBy: userId,
                  requestedAt: now,
                } as any,
              });

              createdAdjustments.push({ index: i, adj, adjustment, previousStock, newStock, adjustmentNumber });
            }

            return createdAdjustments;
          });

          created = results.length;

          // Batch audit logging after successful transaction
          for (const { adj, adjustment, previousStock, newStock, adjustmentNumber } of results) {
            await imdadAudit.log({
              tenantId,
              organizationId: adj.organizationId,
              actorUserId: userId,
              actorRole: role,
              action: 'CREATE',
              resourceType: 'INVENTORY_ADJUSTMENT',
              resourceId: adjustment.id,
              boundedContext: 'BC1_INVENTORY',
              newData: {
                adjustmentNumber,
                itemId: adj.itemId,
                locationId: adj.locationId,
                quantityChange: adj.quantityChange,
                reason: adj.reason,
                previousStock,
                newStock,
              },
              request: req,
            });
          }
        } catch {
          // Transaction failed; mark all as failed
          for (const { index: i, adj } of validAdjustments) {
            failed.push({ index: i, reason: `Failed to create adjustment for item ${adj.itemId}` });
          }
        }
      }

      return NextResponse.json({ created, failed });
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
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.adjustments.create' }
);
