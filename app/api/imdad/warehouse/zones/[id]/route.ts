/**
 * SCM BC2 Warehouse — Zone Detail
 *
 * GET    /api/imdad/warehouse/zones/[id]  — Get zone by id with bins
 * PUT    /api/imdad/warehouse/zones/[id]  — Update zone (optimistic locking)
 * DELETE /api/imdad/warehouse/zones/[id]  — Soft-delete zone
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Get ImdadWarehouseZone by id
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }, params) => {
    const { id } = (await params) as { id: string };

    const zone = await prisma.imdadWarehouseZone.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: {
        bins: { where: { isDeleted: false }, orderBy: { binCode: 'asc' } },
      } as any,
    });

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    return NextResponse.json({ data: zone });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update ImdadWarehouseZone (optimistic locking via version)
// ---------------------------------------------------------------------------
const updateZoneSchema = z.object({
  version: z.number().int('version is required for optimistic locking'),
  zoneName: z.string().min(1).optional(),
  zoneNameAr: z.string().optional(),
  zoneType: z.string().min(1).optional(),
  temperatureZone: z.string().nullable().optional(),
  minTemperature: z.number().nullable().optional(),
  maxTemperature: z.number().nullable().optional(),
  humidityMin: z.number().nullable().optional(),
  humidityMax: z.number().nullable().optional(),
  totalBins: z.number().int().optional(),
  maxWeight: z.number().nullable().optional(),
  requiresBadgeAccess: z.boolean().optional(),
  requiredClearanceLevel: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };
    const body = await req.json();
    const parsed = updateZoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { version, ...updates } = parsed.data;

    const existing = await prisma.imdadWarehouseZone.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }
    if (existing.version !== version) {
      return NextResponse.json(
        { error: 'Version conflict — record was modified by another user', currentVersion: existing.version },
        { status: 409 }
      );
    }

    const oldData = { ...existing } as any;

    const zone = await prisma.imdadWarehouseZone.update({
      where: { id },
      data: {
        ...updates,
        zoneType: updates.zoneType as any,
        temperatureZone: updates.temperatureZone as any,
        version: { increment: 1 },
        updatedBy: userId,
      },
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'UPDATE',
      resourceType: 'WAREHOUSE_ZONE',
      resourceId: zone.id,
      boundedContext: 'BC2_WAREHOUSE',
      previousData: oldData,
      newData: zone as any,
      request: req,
    });

    return NextResponse.json({ data: zone });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete ImdadWarehouseZone
// ---------------------------------------------------------------------------
export const DELETE = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };

    const body = await req.json().catch(() => ({}));
    const version = body?.version;

    const existing = await prisma.imdadWarehouseZone.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    if (version !== undefined && existing.version !== version) {
      return NextResponse.json(
        { error: 'Version conflict — record was modified by another user', currentVersion: existing.version },
        { status: 409 }
      );
    }

    const zone = await prisma.imdadWarehouseZone.update({
      where: { id },
      data: {
        isDeleted: true,
        version: { increment: 1 },
        updatedBy: userId,
      },
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'DELETE',
      resourceType: 'WAREHOUSE_ZONE',
      resourceId: zone.id,
      boundedContext: 'BC2_WAREHOUSE',
      previousData: existing as any,
      request: req,
    });

    return NextResponse.json({ data: { id: zone.id, deleted: true } });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.delete' }
);
