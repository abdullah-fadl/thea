/**
 * SCM Inventory Items — BC1 Item Master
 *
 * GET  /api/imdad/inventory/items  — List items with pagination, search, filters
 * POST /api/imdad/inventory/items  — Create a new item
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadItemMaster
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const search = url.searchParams.get('search')?.trim() || '';
    const status = url.searchParams.get('status') || undefined;
    const itemType = url.searchParams.get('itemType') || undefined;
    const categoryId = url.searchParams.get('categoryId') || undefined;
    const organizationId = url.searchParams.get('organizationId') || undefined;

    const where: any = { tenantId, isDeleted: false };

    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (itemType) where.itemType = itemType;
    if (categoryId) where.categoryId = categoryId;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.imdadItemMaster.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imdadItemMaster.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.view' }
);

// ---------------------------------------------------------------------------
// POST — Create ImdadItemMaster
// ---------------------------------------------------------------------------
const createItemSchema = z.object({
  code: z.string().min(1, 'code is required'),
  name: z.string().min(1, 'name is required'),
  nameAr: z.string().optional(),
  itemType: z.string().min(1, 'itemType is required'),
  organizationId: z.string().min(1, 'organizationId is required'),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  subcategory: z.string().optional(),
  baseUomId: z.string().uuid().optional(),
  purchaseUomId: z.string().uuid().optional(),
  dispensingUomId: z.string().uuid().optional(),
  status: z.string().optional(),
  standardCost: z.number().optional(),
  lastPurchaseCost: z.number().optional(),
  requiresSerialTracking: z.boolean().optional(),
  requiresBatchTracking: z.boolean().optional(),
  requiresColdChain: z.boolean().optional(),
  minShelfLifeDays: z.number().int().optional(),
  manufacturer: z.string().optional(),
  barcode: z.string().optional(),
  genericName: z.string().optional(),
  brandName: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    const body = await req.json();
    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check for duplicate code within tenant + org
    const existing = await prisma.imdadItemMaster.findFirst({
      where: {
        tenantId,
        organizationId: data.organizationId,
        code: data.code,
        isDeleted: false,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Item with this code already exists' },
        { status: 409 }
      );
    }

    const item = await prisma.imdadItemMaster.create({
      data: {
        tenantId,
        organizationId: data.organizationId,
        code: data.code,
        name: data.name,
        nameAr: data.nameAr,
        itemType: data.itemType as any,
        description: data.description,
        categoryId: data.categoryId,
        subcategory: data.subcategory,
        baseUomId: data.baseUomId,
        purchaseUomId: data.purchaseUomId,
        dispensingUomId: data.dispensingUomId,
        status: (data.status || 'ACTIVE') as any,
        standardCost: data.standardCost,
        lastPurchaseCost: data.lastPurchaseCost,
        requiresSerialTracking: data.requiresSerialTracking ?? false,
        requiresBatchTracking: data.requiresBatchTracking ?? true,
        requiresColdChain: data.requiresColdChain ?? false,
        minShelfLifeDays: data.minShelfLifeDays,
        manufacturer: data.manufacturer,
        barcode: data.barcode,
        genericName: data.genericName,
        brandName: data.brandName,
        createdBy: userId,
      } as any,
    });

    await imdadAudit.log({
      tenantId,
      organizationId: data.organizationId,
      actorUserId: userId,
      action: 'CREATE',
      resourceType: 'ITEM_MASTER',
      resourceId: item.id,
      boundedContext: 'BC1_INVENTORY',
      newData: item as any,
      request: req,
    });

    return NextResponse.json({ item }, { status: 201 });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.create' }
);
