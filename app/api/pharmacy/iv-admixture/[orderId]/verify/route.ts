import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params: any) => {
    try {
      const itemId = Object.values(params)[0] as string;
      const body = await req.json().catch(() => ({}));
      const item = await prisma.ivAdmixtureOrder.update({
        where: { id: itemId, tenantId },
        data: {
          status: "VERIFIED",
          verifiedByUserId: userId,
          compatibility: body.compatibility,
          labelPrinted: body.labelPrinted,
          beyondUseDate: body.beyondUseDate,
        },
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[IVADMIXTUREORDER VERIFY] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to verify' }, { status: 500 });
    }
  },
  { permissionKey: 'pharmacy.iv-admixture.edit' }
);
