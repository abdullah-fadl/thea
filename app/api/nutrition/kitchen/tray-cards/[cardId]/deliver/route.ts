import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params: any) => {
    try {
      const itemId = Object.values(params)[0];
      const body = await req.json().catch(() => ({}));
      const item = await (prisma as Record<string, any>).kitchenTrayCard.update({
        where: { id: itemId, tenantId },
        data: { status: "RECEIVED", receivedAt: new Date(), ...body },
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[KITCHENTRAYCARD DELIVER] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to deliver' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.kitchen.edit' }
);
