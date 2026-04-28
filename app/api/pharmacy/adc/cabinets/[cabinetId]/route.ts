import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const itemId = ((params as Record<string, string>).cabinetId || Object.values(params)[0]) as string;
      const item = await prisma.adcCabinet.findFirst({
        where: { tenantId, id: itemId },
      });
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[ADCCABINET GET-DETAIL] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { permissionKey: 'pharmacy.adc.view' }
);

export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const itemId = ((params as Record<string, string>).cabinetId || Object.values(params)[0]) as string;
      const body = await req.json();
      const item = await prisma.adcCabinet.update({
        where: { id: itemId, tenantId },
        data: {
          cabinetName: body.cabinetName,
          location: body.location,
          manufacturer: body.manufacturer,
          model: body.model,
          serialNumber: body.serialNumber,
          status: body.status,
          lastSyncAt: body.lastSyncAt,
          totalPockets: body.totalPockets,
        },
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[ADCCABINET PATCH] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
  },
  { permissionKey: 'pharmacy.adc.edit' }
);
