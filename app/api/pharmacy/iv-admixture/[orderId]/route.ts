import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const itemId = ((params as Record<string, string>).orderId || Object.values(params)[0]) as string;
      const item = await prisma.ivAdmixtureOrder.findFirst({
        where: { tenantId, id: itemId },
      });
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[IVADMIXTUREORDER GET-DETAIL] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { permissionKey: 'pharmacy.iv-admixture.view' }
);

export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const itemId = ((params as Record<string, string>).orderId || Object.values(params)[0]) as string;
      const body = await req.json();
      const item = await prisma.ivAdmixtureOrder.update({
        where: { id: itemId, tenantId },
        data: {
          drug: body.drug,
          drugCode: body.drugCode,
          diluent: body.diluent,
          diluentVolume: body.diluentVolume,
          drugDose: body.drugDose,
          drugDoseUnit: body.drugDoseUnit,
          finalConcentration: body.finalConcentration,
          concentrationUnit: body.concentrationUnit,
          infusionRate: body.infusionRate,
          infusionDuration: body.infusionDuration,
          compatibility: body.compatibility,
          ySiteCompatible: body.ySiteCompatible,
          stabilityHours: body.stabilityHours,
          storageCondition: body.storageCondition,
          beyondUseDate: body.beyondUseDate,
          status: body.status,
          preparedByUserId: body.preparedByUserId,
          labelPrinted: body.labelPrinted,
          batchId: body.batchId,
        },
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[IVADMIXTUREORDER PATCH] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
  },
  { permissionKey: 'pharmacy.iv-admixture.edit' }
);
