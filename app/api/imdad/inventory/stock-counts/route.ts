/**
 * SCM Stock Counts — BC1 Inventory
 *
 * GET  /api/imdad/inventory/stock-counts  — List stock count sessions
 * POST /api/imdad/inventory/stock-counts  — Create stock count session (PLANNED)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadStockCount
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const status = url.searchParams.get('status') || undefined;
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const locationId = url.searchParams.get('locationId') || undefined;

    const where: any = { tenantId, isDeleted: false };

    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (locationId) where.locationId = locationId;

    const [stockCounts, total] = await Promise.all([
      prisma.imdadStockCount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imdadStockCount.count({ where }),
    ]);

    return NextResponse.json({
      stockCounts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.view' }
);

// ---------------------------------------------------------------------------
// POST — Create ImdadStockCount session in PLANNED status
// ---------------------------------------------------------------------------
const createStockCountSchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  locationId: z.string().min(1, 'locationId is required'),
  countType: z.string().min(1, 'countType is required'),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  scheduledDate: z.string().datetime({ message: 'scheduledDate must be a valid ISO date' }),
  itemIds: z.array(z.string()).optional(),
  assignedTo: z.array(z.string()).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    const body = await req.json();
    const parsed = createStockCountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify location exists
    const location = await prisma.imdadInventoryLocation.findFirst({
      where: { id: data.locationId, tenantId, isDeleted: false },
      select: { id: true },
    });
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const stockCount = await prisma.imdadStockCount.create({
      data: {
        tenantId,
        organizationId: data.organizationId,
        locationId: data.locationId,
        countNumber: `SC-${Date.now()}`,
        countType: data.countType,
        scheduledDate: new Date(data.scheduledDate),
        status: 'DRAFT' as any,
        notes: data.notes,
        createdBy: userId,
      } as any,
    });

    await imdadAudit.log({
      tenantId,
      organizationId: data.organizationId,
      actorUserId: userId,
      action: 'CREATE',
      resourceType: 'STOCK_COUNT',
      resourceId: stockCount.id,
      boundedContext: 'BC1_INVENTORY',
      newData: stockCount as any,
      request: req,
    });

    return NextResponse.json({ stockCount }, { status: 201 });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.count' }
);
