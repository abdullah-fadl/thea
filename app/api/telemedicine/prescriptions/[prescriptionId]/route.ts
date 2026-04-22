import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: Record<string, string>) => {
    try {
      const itemId = (params as Record<string, string>).prescriptionId || Object.values(params)[0];
      const item = await prisma.telePrescription.findFirst({
        where: { tenantId, id: itemId },
      });
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[TELEPRESCRIPTION GET-DETAIL] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { permissionKey: 'telemedicine.prescriptions.view' }
);

export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: Record<string, string>) => {
    try {
      const itemId = (params as Record<string, string>).prescriptionId || Object.values(params)[0];
      const body = await req.json();
      const item = await prisma.telePrescription.update({
        where: { id: itemId, tenantId },
        data: body,
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[TELEPRESCRIPTION PATCH] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
  },
  { permissionKey: 'telemedicine.prescriptions.edit' }
);
