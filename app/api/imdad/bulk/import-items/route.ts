/**
 * SCM Bulk — Import Items from JSON Array
 *
 * POST /api/imdad/bulk/import-items
 * Body: { items: ItemCreateData[] }
 * Returns: { imported: number, skipped: number, errors: { row: number, reason: string }[] }
 *
 * Max 500 items per batch. Skips duplicates by itemCode.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

export const dynamic = 'force-dynamic';

const itemCreateSchema = z.object({
  code: z.string().min(1, 'Item code is required').max(100),
  name: z.string().min(1, 'Item name is required').max(500),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  organizationId: z.string().uuid(),
  itemType: z.enum([
    'PHARMACEUTICAL',
    'MEDICAL_SUPPLY',
    'MEDICAL_DEVICE',
    'LABORATORY',
    'SURGICAL',
    'GENERAL',
    'FOOD_SERVICE',
    'MAINTENANCE',
    'IT_EQUIPMENT',
    'FURNITURE',
    'LINEN',
    'CLEANING',
    'IMPLANT',
    'REAGENT',
  ]),
  categoryId: z.string().uuid().optional(),
  subcategory: z.string().optional(),
  genericName: z.string().optional(),
  brandName: z.string().optional(),
  barcode: z.string().optional(),
  gtin: z.string().optional(),
  baseUomId: z.string().uuid().optional(),
  purchaseUomId: z.string().uuid().optional(),
  dispensingUomId: z.string().uuid().optional(),
  isCritical: z.boolean().optional(),
  isControlled: z.boolean().optional(),
  requiresColdChain: z.boolean().optional(),
  expiryTracked: z.boolean().optional(),
  requiresBatchTracking: z.boolean().optional(),
  requiresSerialTracking: z.boolean().optional(),
  standardCost: z.number().nonnegative().optional(),
  lastPurchaseCost: z.number().nonnegative().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  manufacturer: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  sfdaRegistration: z.string().optional(),
  formularyStatus: z.string().optional(),
  abcClassification: z.string().optional(),
  vedClassification: z.string().optional(),
});

const bulkImportSchema = z.object({
  items: z
    .array(itemCreateSchema)
    .min(1, 'At least one item is required')
    .max(500, 'Maximum 500 items per batch'),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = bulkImportSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { items } = parsed.data;
      let imported = 0;
      let skipped = 0;
      const errors: { row: number; reason: string }[] = [];

      // Pre-fetch existing item codes to detect duplicates
      const codes = items.map((item) => item.code);
      const existingItems = await prisma.imdadItemMaster.findMany({
        where: {
          tenantId,
          code: { in: codes },
          isDeleted: false,
        },
        select: { code: true },
      });

      const existingCodes = new Set(existingItems.map((i) => i.code));

      // Track codes within this batch to detect intra-batch duplicates
      const batchCodes = new Set<string>();

      for (let row = 0; row < items.length; row++) {
        const item = items[row];

        // Skip if duplicate in DB
        if (existingCodes.has(item.code)) {
          skipped++;
          continue;
        }

        // Skip if duplicate within this batch
        if (batchCodes.has(item.code)) {
          skipped++;
          continue;
        }

        batchCodes.add(item.code);

        try {
          const created = await prisma.imdadItemMaster.create({
            data: {
              tenantId,
              organizationId: item.organizationId,
              code: item.code,
              name: item.name,
              nameAr: item.nameAr,
              description: item.description,
              descriptionAr: item.descriptionAr,
              itemType: item.itemType,
              categoryId: item.categoryId,
              subcategory: item.subcategory,
              genericName: item.genericName,
              brandName: item.brandName,
              barcode: item.barcode,
              gtin: item.gtin,
              baseUomId: item.baseUomId,
              purchaseUomId: item.purchaseUomId,
              dispensingUomId: item.dispensingUomId,
              isCritical: item.isCritical ?? false,
              isControlled: item.isControlled ?? false,
              requiresColdChain: item.requiresColdChain ?? false,
              expiryTracked: item.expiryTracked ?? true,
              requiresBatchTracking: item.requiresBatchTracking ?? true,
              requiresSerialTracking: item.requiresSerialTracking ?? false,
              standardCost: item.standardCost,
              lastPurchaseCost: item.lastPurchaseCost,
              taxRate: item.taxRate,
              manufacturer: item.manufacturer,
              countryOfOrigin: item.countryOfOrigin,
              sfdaRegistration: item.sfdaRegistration,
              formularyStatus: item.formularyStatus,
              abcClassification: item.abcClassification,
              vedClassification: item.vedClassification,
              status: 'ACTIVE',
              createdBy: userId,
              updatedBy: userId,
            } as any,
          });

          await imdadAudit.log({
            tenantId,
            organizationId: item.organizationId,
            actorUserId: userId,
            actorRole: role,
            action: 'CREATE',
            resourceType: 'item_master',
            resourceId: created.id,
            boundedContext: 'BC1_INVENTORY',
            newData: { code: item.code, name: item.name, itemType: item.itemType },
            request: req,
          });

          imported++;
        } catch (err: any) {
          // Handle unique constraint violations gracefully
          if (err?.code === 'P2002') {
            skipped++;
          } else {
            errors.push({ row, reason: `Failed to create item "${item.code}": ${err?.message || 'Unknown error'}` });
          }
        }
      }

      return NextResponse.json({ imported, skipped, errors });
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
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.items.create' }
);
