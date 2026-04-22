import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  async (req, { tenantId }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const runId = String((resolvedParams as Record<string, string>)?.runId || '').trim();
      if (!runId) {
        return NextResponse.json({ error: 'runId is required' }, { status: 400 });
      }

      const run = await prisma.integrityRun.findFirst({
        where: { tenantId, id: runId, cancelledAt: null },
      });
      if (!run) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }

      return NextResponse.json(run);
    } catch (error: any) {
      logger.error('Integrity run fetch error', { error });
      // [SEC-06]
      return NextResponse.json(
        { error: 'Failed to load integrity run' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.read' }
);
