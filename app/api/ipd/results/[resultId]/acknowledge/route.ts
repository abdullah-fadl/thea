import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }, params: Record<string, string>) => {
    try {
      const resultId = params.resultId;

      const result = await prisma.orderResult.findFirst({
        where: { id: resultId, tenantId },
      });

      if (!result) {
        return NextResponse.json({ error: 'Result not found' }, { status: 404 });
      }

      const ack = await prisma.orderResultAck.create({
        data: {
          tenantId,
          orderId: result.orderId,
          userId,
          time: new Date(),
        },
      });

      return NextResponse.json({ success: true, ack });
    } catch (e) {
      logger.error('[IPD RESULT ACK] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to acknowledge' }, { status: 500 });
    }
  },
  { permissionKey: 'ipd.results.acknowledge' }
);
