/**
 * SCM BC2 Warehouse — Bin Detail
 *
 * GET    /api/imdad/warehouse/bins/[id]  — Get bin by id
 * PUT    /api/imdad/warehouse/bins/[id]  — Update bin (optimistic locking)
 * PATCH  /api/imdad/warehouse/bins/[id]  — Update bin status
 * DELETE /api/imdad/warehouse/bins/[id]  — Soft-delete bin
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Get ImdadBin by id
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }, params) => {
    const { id } = (await params) as { id: string };

    const bin = await prisma.imdadBin.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!bin) {
      return NextResponse.json({ error: 'Bin not found' }, { status: 404 });
    }

    return NextResponse.json({ data: bin });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update ImdadBin (optimistic locking via version)
// ---------------------------------------------------------------------------
const updateBinSchema = z.object({
  version: z.number().int('version is required for optimistic locking'),
  binLabel: z.string().optional(),
  binLabelAr: z.string().optional(),
  aisle: z.string().optional(),
  rack: z.string().optional(),
  shelf: z.string().optional(),
  position: z.string().optional(),
  barcode: z.string().optional(),
  widthCm: z.number().nullable().optional(),
  heightCm: z.number().nullable().optional(),
  depthCm: z.number().nullable().optional(),
  maxWeightKg: z.number().nullable().optional(),
  status: z.string().optional(),
  currentItemId: z.string().nullable().optional(),
  currentQuantity: z.number().optional(),
  isMixedItem: z.boolean().optional(),
  cycleCountFrequency: z.string().nullable().optional(),
  lastCountDate: z.string().optional(),
  nextCountDate: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };
    const body = await req.json();
    const parsed = updateBinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { version, lastCountDate, nextCountDate, ...updates } = parsed.data;

    const existing = await prisma.imdadBin.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Bin not found' }, { status: 404 });
    }
    if (existing.version !== version) {
      return NextResponse.json(
        { error: 'Version conflict — record was modified by another user', currentVersion: existing.version },
        { status: 409 }
      );
    }

    const oldData = { ...existing } as any;

    const bin = await prisma.imdadBin.update({
      where: { id },
      data: {
        ...updates,
        status: updates.status as any,
        cycleCountFrequency: updates.cycleCountFrequency as any,
        lastCountDate: lastCountDate ? new Date(lastCountDate) : undefined,
        nextCountDate: nextCountDate ? new Date(nextCountDate) : undefined,
        version: { increment: 1 },
        updatedBy: userId,
      },
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'UPDATE',
      resourceType: 'BIN',
      resourceId: bin.id,
      boundedContext: 'BC2_WAREHOUSE',
      previousData: oldData,
      newData: bin as any,
      request: req,
    });

    return NextResponse.json({ data: bin });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.update' }
);

// ---------------------------------------------------------------------------
// PATCH — Update ImdadBin status
// ---------------------------------------------------------------------------
const patchBinStatusSchema = z.object({
  version: z.number().int('version is required for optimistic locking'),
  status: z.string().min(1, 'status is required'),
});

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };
    const body = await req.json();
    const parsed = patchBinStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { version, status } = parsed.data;

    const existing = await prisma.imdadBin.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Bin not found' }, { status: 404 });
    }
    if (existing.version !== version) {
      return NextResponse.json(
        { error: 'Version conflict — record was modified by another user', currentVersion: existing.version },
        { status: 409 }
      );
    }

    const oldData = { ...existing } as any;

    const bin = await prisma.imdadBin.update({
      where: { id },
      data: {
        status: status as any,
        version: { increment: 1 },
        updatedBy: userId,
      },
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'UPDATE',
      resourceType: 'BIN',
      resourceId: bin.id,
      boundedContext: 'BC2_WAREHOUSE',
      previousData: oldData,
      newData: bin as any,
      request: req,
    });

    return NextResponse.json({ data: bin });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete ImdadBin
// ---------------------------------------------------------------------------
export const DELETE = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };

    const body = await req.json().catch(() => ({}));
    const version = body?.version;

    const existing = await prisma.imdadBin.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Bin not found' }, { status: 404 });
    }

    if (version !== undefined && existing.version !== version) {
      return NextResponse.json(
        { error: 'Version conflict — record was modified by another user', currentVersion: existing.version },
        { status: 409 }
      );
    }

    const bin = await prisma.imdadBin.update({
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
      resourceType: 'BIN',
      resourceId: bin.id,
      boundedContext: 'BC2_WAREHOUSE',
      previousData: existing as any,
      request: req,
    });

    return NextResponse.json({ data: { id: bin.id, deleted: true } });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.delete' }
);
