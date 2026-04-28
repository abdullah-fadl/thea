import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const itemId = (params as Record<string, string>)?.caseId || Object.values(params || {})[0];
      const item = await (prisma as Record<string, any>).orthodonticCase.findFirst({
        where: { tenantId, id: itemId },
      });
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[ORTHODONTICCASE GET-DETAIL] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { permissionKey: 'dental.orthodontic.view' }
);

export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const itemId = (params as Record<string, string>)?.caseId || Object.values(params || {})[0];
      const body = await req.json();
      const item = await (prisma as Record<string, any>).orthodonticCase.update({
        where: { id: itemId, tenantId },
        data: body,
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[ORTHODONTICCASE PATCH] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
  },
  { permissionKey: 'dental.orthodontic.edit' }
);
