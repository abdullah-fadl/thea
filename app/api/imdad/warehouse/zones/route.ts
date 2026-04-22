/**
 * SCM BC2 Warehouse — Zones
 *
 * GET  /api/imdad/warehouse/zones  — List zones with pagination, search, filters
 * POST /api/imdad/warehouse/zones  — Create a new zone
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadWarehouseZone
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const search = url.searchParams.get('search')?.trim() || '';
    const warehouseId = url.searchParams.get('warehouseId') || undefined;
    const zoneType = url.searchParams.get('zoneType') || undefined;
    const temperatureZone = url.searchParams.get('temperatureZone') || undefined;
    const isActive = url.searchParams.get('isActive');

    const where: any = { tenantId, isDeleted: false };

    if (warehouseId) where.warehouseId = warehouseId;
    if (zoneType) where.zoneType = zoneType;
    if (temperatureZone) where.temperatureZone = temperatureZone;
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { zoneName: { contains: search, mode: 'insensitive' } },
        { zoneCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.imdadWarehouseZone.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imdadWarehouseZone.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.view' }
);

// ---------------------------------------------------------------------------
// POST — Create ImdadWarehouseZone
// ---------------------------------------------------------------------------
const createZoneSchema = z.object({
  warehouseId: z.string().min(1, 'warehouseId is required'),
  zoneCode: z.string().min(1, 'zoneCode is required'),
  zoneName: z.string().min(1, 'zoneName is required'),
  zoneNameAr: z.string().optional(),
  organizationId: z.string().min(1, 'organizationId is required'),
  zoneType: z.string().min(1, 'zoneType is required'),
  temperatureZone: z.string().optional(),
  minTemperature: z.number().optional(),
  maxTemperature: z.number().optional(),
  humidityMin: z.number().optional(),
  humidityMax: z.number().optional(),
  totalBins: z.number().int().optional(),
  maxWeight: z.number().optional(),
  requiresBadgeAccess: z.boolean().optional(),
  requiredClearanceLevel: z.string().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    const body = await req.json();
    const parsed = createZoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check for duplicate zoneCode within tenant + warehouse
    const existing = await prisma.imdadWarehouseZone.findFirst({
      where: {
        tenantId,
        warehouseId: data.warehouseId,
        zoneCode: data.zoneCode,
        isDeleted: false,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Zone with this code already exists in this warehouse' },
        { status: 409 }
      );
    }

    const zone = await prisma.imdadWarehouseZone.create({
      data: {
        tenantId,
        organizationId: data.organizationId,
        warehouseId: data.warehouseId,
        zoneCode: data.zoneCode,
        zoneName: data.zoneName,
        zoneNameAr: data.zoneNameAr,
        zoneType: data.zoneType as any,
        temperatureZone: data.temperatureZone as any,
        minTemperature: data.minTemperature,
        maxTemperature: data.maxTemperature,
        humidityMin: data.humidityMin,
        humidityMax: data.humidityMax,
        totalBins: data.totalBins ?? 0,
        maxWeight: data.maxWeight,
        requiresBadgeAccess: data.requiresBadgeAccess ?? false,
        requiredClearanceLevel: data.requiredClearanceLevel,
        isActive: data.isActive ?? true,
        metadata: data.metadata ?? undefined,
        createdBy: userId,
      } as any,
    });

    await imdadAudit.log({
      tenantId,
      organizationId: data.organizationId,
      actorUserId: userId,
      action: 'CREATE',
      resourceType: 'WAREHOUSE_ZONE',
      resourceId: zone.id,
      boundedContext: 'BC2_WAREHOUSE',
      newData: zone as any,
      request: req,
    });

    return NextResponse.json({ data: zone }, { status: 201 });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.create' }
);
