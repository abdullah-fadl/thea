/**
 * SCM BC2 Warehouse — Warehouse Detail
 *
 * GET    /api/imdad/warehouse/warehouses/[id]  — Get warehouse by id with zones and receivingDocks
 * PUT    /api/imdad/warehouse/warehouses/[id]  — Update warehouse (optimistic locking)
 * DELETE /api/imdad/warehouse/warehouses/[id]  — Soft-delete warehouse
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Get ImdadWarehouse by id
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }, params) => {
    const { id } = (await params) as { id: string };

    const warehouse = await prisma.imdadWarehouse.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: {
        zones: { where: { isDeleted: false }, orderBy: { zoneCode: 'asc' } },
        receivingDocks: { where: { isDeleted: false }, orderBy: { dockCode: 'asc' } },
      } as any,
    });

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    return NextResponse.json({ data: warehouse });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update ImdadWarehouse (optimistic locking via version)
// ---------------------------------------------------------------------------
const updateWarehouseSchema = z.object({
  version: z.number().int('version is required for optimistic locking'),
  warehouseName: z.string().min(1).optional(),
  warehouseNameAr: z.string().optional(),
  facilityType: z.string().min(1).optional(),
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
  managerUserId: z.string().nullable().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };
    const body = await req.json();
    const parsed = updateWarehouseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { version, ...updates } = parsed.data;

    const existing = await prisma.imdadWarehouse.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }
    if (existing.version !== version) {
      return NextResponse.json(
        { error: 'Version conflict — record was modified by another user', currentVersion: existing.version },
        { status: 409 }
      );
    }

    const oldData = { ...existing } as any;

    const warehouse = await prisma.imdadWarehouse.update({
      where: { id },
      data: {
        ...updates,
        temperatureZones: updates.temperatureZones as any,
        version: { increment: 1 },
        updatedBy: userId,
      },
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'UPDATE',
      resourceType: 'WAREHOUSE',
      resourceId: warehouse.id,
      boundedContext: 'BC2_WAREHOUSE',
      previousData: oldData,
      newData: warehouse as any,
      request: req,
    });

    return NextResponse.json({ data: warehouse });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete ImdadWarehouse
// ---------------------------------------------------------------------------
export const DELETE = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };

    const existing = await prisma.imdadWarehouse.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    const warehouse = await prisma.imdadWarehouse.update({
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
      resourceType: 'WAREHOUSE',
      resourceId: warehouse.id,
      boundedContext: 'BC2_WAREHOUSE',
      previousData: existing as any,
      request: req,
    });

    return NextResponse.json({ data: { id: warehouse.id, deleted: true } });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.delete' }
);
