import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String(resolvedParams?.id || '');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const equipment = await prisma.equipment.findFirst({ where: { id, tenantId } });
    if (!equipment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [maintenanceRecords, issues] = await Promise.all([
      prisma.equipmentMaintenance.findMany({
        where: { equipmentId: id, tenantId },
        orderBy: { performedAt: 'desc' },
        take: 20,
      }),
      prisma.equipmentIssue.findMany({
        where: { equipmentId: id, tenantId },
        orderBy: { reportedAt: 'desc' },
        take: 20,
      }),
    ]);

    return NextResponse.json({ equipment, maintenanceRecords, issues });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'equipment.view' }
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String(resolvedParams?.id || '');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const existing = await prisma.equipment.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const VALID_STATUSES = new Set(['OPERATIONAL', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'CALIBRATION_DUE']);
    const VALID_CATEGORIES = new Set(['VENTILATOR', 'MONITOR', 'PUMP', 'IMAGING', 'LAB', 'SURGICAL', 'DEFIBRILLATOR', 'OTHER']);

    const updateData: any = {};

    // Allow updating all equipment fields
    if (body.name !== undefined) updateData.name = String(body.name);
    if (body.assetTag !== undefined) updateData.assetTag = String(body.assetTag);
    if (body.category !== undefined && VALID_CATEGORIES.has(String(body.category).toUpperCase())) {
      updateData.category = String(body.category).toUpperCase();
    }
    if (body.manufacturer !== undefined) updateData.manufacturer = body.manufacturer ? String(body.manufacturer) : null;
    if (body.model !== undefined) updateData.model = body.model ? String(body.model) : null;
    if (body.serialNumber !== undefined) updateData.serialNumber = body.serialNumber ? String(body.serialNumber) : null;
    if (body.location !== undefined) updateData.location = body.location ? String(body.location) : null;
    if (body.status !== undefined && VALID_STATUSES.has(String(body.status))) {
      updateData.status = String(body.status);
    }
    if (body.notes !== undefined) updateData.notes = body.notes ? String(body.notes) : null;
    if (body.purchaseDate !== undefined) updateData.purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : null;
    if (body.warrantyExpiry !== undefined) updateData.warrantyExpiry = body.warrantyExpiry ? new Date(body.warrantyExpiry) : null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.equipment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, equipment: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'equipment.manage' }
);
