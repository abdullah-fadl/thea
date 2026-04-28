import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const itemId = params.entryId || Object.values(params)[0];
      const item = await prisma.schedulingWaitlist.findFirst({
        where: { tenantId, id: itemId },
      });
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[SCHEDULINGWAITLIST GET-DETAIL] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { permissionKey: 'scheduling.waitlist.view' }
);

export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const itemId = params.entryId || Object.values(params)[0];
      const body = await req.json();
      const item = await prisma.schedulingWaitlist.update({
        where: { id: itemId, tenantId },
        data: body,
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[SCHEDULINGWAITLIST PATCH] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
  },
  { permissionKey: 'scheduling.waitlist.edit' }
);
