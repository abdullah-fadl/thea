import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const where: Record<string, unknown> = { tenantId };
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);

      if (status) where.status = status;

      const messages = await prisma.integrationMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 500),
      });

      return NextResponse.json({ messages });
    } catch (e) {
      logger.error('[LIS MESSAGE-QUEUE] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { permissionKey: 'lab.lis-dashboard.view' }
);
