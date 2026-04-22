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
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);

      if (status === 'IN_PROGRESS') {
        where.status = { notIn: ['DECLARED', 'ABORTED'] };
      } else if (status) {
        where.status = status;
      }

      const protocols = await (prisma as Record<string, unknown> & typeof prisma).brainDeathProtocol.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
      });

      return NextResponse.json({ protocols });
    } catch (e) {
      logger.error('[BRAIN-DEATH LIST] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { permissionKey: 'icu.brain-death.view' }
);
