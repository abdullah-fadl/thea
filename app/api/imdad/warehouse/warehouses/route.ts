/**
 * SCM BC2 Warehouse — Warehouses
 *
 * GET  /api/imdad/warehouse/warehouses  — List warehouses with pagination, search, filters
 * POST /api/imdad/warehouse/warehouses  — Create a new warehouse
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadWarehouse
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const search = url.searchParams.get('search')?.trim() || '';
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const facilityType = url.searchParams.get('facilityType') || undefined;
    const isActive = url.searchParams.get('isActive');

    const where: any = { tenantId, isDeleted: false };

    if (organizationId) where.organizationId = organizationId;
    if (facilityType) where.facilityType = facilityType;
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { warehouseName: { contains: search, mode: 'insensitive' } },
        { warehouseCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.imdadWarehouse.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imdadWarehouse.count({ where }),
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
// POST — Create ImdadWarehouse
// ---------------------------------------------------------------------------
const createWarehouseSchema = z.object({
  warehouseCode: z.string().min(1, 'warehouseCode is required'),
  warehouseName: z.string().min(1, 'warehouseName is required'),
  warehouseNameAr: z.string().optional(),
  organizationId: z.string().min(1, 'organizationId is required'),
  facilityType: z.string().min(1, 'facilityType is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  totalAreaSqm: z.number().optional(),
  operatingHoursStart: z.string().optional(),
  operatingHoursEnd: z.string().optional(),
  operatingDays: z.array(z.string()).optional(),
  hasTemperatureMonitoring: z.boolean().optional(),
  temperatureZones: z.array(z.string()).optional(),
  managerUserId: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    const body = await req.json();
    const parsed = createWarehouseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check for duplicate warehouseCode within tenant + org
    const existing = await prisma.imdadWarehouse.findFirst({
      where: {
        tenantId,
        organizationId: data.organizationId,
        warehouseCode: data.warehouseCode,
        isDeleted: false,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Warehouse with this code already exists' },
        { status: 409 }
      );
    }

    const warehouse = await prisma.imdadWarehouse.create({
      data: {
        tenantId,
        organizationId: data.organizationId,
        warehouseCode: data.warehouseCode,
        warehouseName: data.warehouseName,
        warehouseNameAr: data.warehouseNameAr,
        facilityType: data.facilityType,
        address: data.address,
        city: data.city,
        region: data.region,
        country: data.country ?? 'SA',
        totalAreaSqm: data.totalAreaSqm,
        operatingHoursStart: data.operatingHoursStart,
        operatingHoursEnd: data.operatingHoursEnd,
        operatingDays: data.operatingDays,
        hasTemperatureMonitoring: data.hasTemperatureMonitoring ?? false,
        temperatureZones: data.temperatureZones as any,
        managerUserId: data.managerUserId,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
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
      resourceType: 'WAREHOUSE',
      resourceId: warehouse.id,
      boundedContext: 'BC2_WAREHOUSE',
      newData: warehouse as any,
      request: req,
    });

    return NextResponse.json({ data: warehouse }, { status: 201 });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.create' }
);
