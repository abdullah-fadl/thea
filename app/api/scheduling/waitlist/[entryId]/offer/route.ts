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
      const item = await prisma.schedulingWaitlist.update({
        where: { id: itemId, tenantId },
        data: {
          status: "OFFERED",
          offeredAt: new Date(),
          ...(body.offeredSlotId != null && { offeredSlotId: body.offeredSlotId }),
          ...(body.message != null && { message: body.message }),
          ...(body.expiresAt != null && { expiresAt: body.expiresAt }),
        },
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[SCHEDULINGWAITLIST OFFER] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to offer' }, { status: 500 });
    }
  },
  { permissionKey: 'scheduling.waitlist.edit' }
);
