/**
 * SCM Inventory Locations — BC1 Inventory
 *
 * GET  /api/imdad/inventory/locations  — List inventory locations
 * POST /api/imdad/inventory/locations  — Create inventory location
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadInventoryLocation
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const search = url.searchParams.get('search')?.trim() || '';
    const locationType = url.searchParams.get('locationType') || undefined;
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const parentLocationId = url.searchParams.get('parentLocationId') || undefined;

    const where: any = { tenantId, isDeleted: false };

    if (organizationId) where.organizationId = organizationId;
    if (locationType) where.type = locationType;
    if (parentLocationId) where.parentId = parentLocationId;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [locations, total] = await Promise.all([
      prisma.imdadInventoryLocation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imdadInventoryLocation.count({ where }),
    ]);

    return NextResponse.json({
      locations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.view' }
);

// ---------------------------------------------------------------------------
// POST — Create ImdadInventoryLocation
// ---------------------------------------------------------------------------
const createLocationSchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  code: z.string().min(1, 'code is required'),
  name: z.string().min(1, 'name is required'),
  locationType: z.string().min(1, 'locationType is required'),
  parentLocationId: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
  isQuarantine: z.boolean().optional(),
  temperatureZone: z.string().optional(),
  capacity: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    const body = await req.json();
    const parsed = createLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check duplicate code within tenant + org
    const existing = await prisma.imdadInventoryLocation.findFirst({
      where: {
        tenantId,
        organizationId: data.organizationId,
        code: data.code,
        isDeleted: false,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Location with this code already exists' },
        { status: 409 }
      );
    }

    const location = await prisma.imdadInventoryLocation.create({
      data: {
        tenantId,
        organizationId: data.organizationId,
        code: data.code,
        name: data.name,
        type: data.locationType,
        parentId: data.parentLocationId,
        temperatureZone: data.temperatureZone,
        capacity: data.capacity,
        isActive: data.isActive ?? true,
        createdBy: userId,
      } as any,
    });

    await imdadAudit.log({
      tenantId,
      organizationId: data.organizationId,
      actorUserId: userId,
      action: 'CREATE',
      resourceType: 'INVENTORY_LOCATION',
      resourceId: location.id,
      boundedContext: 'BC1_INVENTORY',
      newData: location as any,
      request: req,
    });

    return NextResponse.json({ location }, { status: 201 });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.create' }
);
