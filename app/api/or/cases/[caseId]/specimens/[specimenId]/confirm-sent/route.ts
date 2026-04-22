import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** POST /api/or/cases/[caseId]/specimens/[specimenId]/confirm-sent */
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params) => {
    try {
      const caseId = String((params as Record<string, string>)?.caseId || '').trim();
      const specimenId = String((params as Record<string, string>)?.specimenId || '').trim();
      if (!caseId || !specimenId) {
        return NextResponse.json({ error: 'caseId and specimenId are required' }, { status: 400 });
      }

      const existing = await (prisma as Record<string, any>).orSpecimenLog?.findFirst?.({
        where: { tenantId, id: specimenId, caseId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Specimen not found' }, { status: 404 });
      }
      if (existing.sentConfirmed) {
        return NextResponse.json({ error: 'Specimen already confirmed as sent' }, { status: 400 });
      }

      const updated = await (prisma as Record<string, any>).orSpecimenLog?.update?.({
        where: { id: specimenId },
        data: {
          sentConfirmed: true,
          sentConfirmedAt: new Date(),
          sentConfirmedBy: userId,
        },
      });

      return NextResponse.json({ specimen: updated });
    } catch (e: any) {
      logger.error('[OR specimen confirm-sent POST]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to confirm specimen sent' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.nursing.view' },
);
