import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** POST /api/or/cases/[caseId]/surgical-counts/[countId]/resolve */
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params) => {
    try {
      const caseId = String((params as Record<string, string>)?.caseId || '').trim();
      const countId = String((params as Record<string, string>)?.countId || '').trim();
      if (!caseId || !countId) {
        return NextResponse.json({ error: 'caseId and countId are required' }, { status: 400 });
      }

      const body = await req.json();
      const { resolutionNote } = body;
      if (!resolutionNote?.trim()) {
        return NextResponse.json({ error: 'resolutionNote is required' }, { status: 400 });
      }

      // Verify count exists for this case
      const existing = await (prisma as Record<string, any>).orSurgicalCount?.findFirst?.({
        where: { tenantId, id: countId, caseId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Count record not found' }, { status: 404 });
      }
      if (!existing.isDiscrepancy) {
        return NextResponse.json({ error: 'No discrepancy to resolve' }, { status: 400 });
      }

      const updated = await (prisma as Record<string, any>).orSurgicalCount?.update?.({
        where: { id: countId },
        data: {
          discrepancyResolved: true,
          resolutionNote: resolutionNote.trim(),
          resolvedAt: new Date(),
          resolvedByUserId: userId,
        },
      });

      return NextResponse.json({ count: updated });
    } catch (e: any) {
      logger.error('[OR count resolve POST]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to resolve discrepancy' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.nursing.view' },
);
