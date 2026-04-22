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

    const records = await prisma.equipmentMaintenance.findMany({
      where: { equipmentId: id, tenantId },
      orderBy: { performedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ records });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'equipment.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String(resolvedParams?.id || '');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const equipment = await prisma.equipment.findFirst({ where: { id, tenantId } });
    if (!equipment) return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { maintenanceType, findings, partsReplaced, cost, nextDueDate, notes } = body;

    if (!maintenanceType) {
      return NextResponse.json({ error: 'maintenanceType is required' }, { status: 400 });
    }

    const record = await prisma.equipmentMaintenance.create({
      data: {
        tenantId,
        equipmentId: id,
        maintenanceType: String(maintenanceType),
        performedBy: userId,
        performedAt: new Date(),
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        findings: findings ? String(findings) : null,
        partsReplaced: partsReplaced ?? [],
        cost: cost != null ? Number(cost) : null,
        status: 'COMPLETED',
        notes: notes ? String(notes) : null,
      },
    });

    // Auto-update equipment status based on maintenance type
    if (maintenanceType === 'CORRECTIVE') {
      await prisma.equipment.update({
        where: { id },
        data: { status: 'OPERATIONAL' },
      });
    } else if (maintenanceType === 'CALIBRATION') {
      await prisma.equipment.update({
        where: { id },
        data: { status: 'OPERATIONAL' },
      });
    }

    return NextResponse.json({ success: true, id: record.id, record });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'equipment.manage' }
);
