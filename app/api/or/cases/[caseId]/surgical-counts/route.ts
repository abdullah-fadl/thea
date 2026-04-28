import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function sumItems(items: any[]): { expected: number; actual: number } {
  let expected = 0, actual = 0;
  for (const i of items) {
    expected += Number(i.expectedCount) || 0;
    actual += Number(i.actualCount) || 0;
  }
  return { expected, actual };
}

/** GET /api/or/cases/[caseId]/surgical-counts */
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const caseId = String((params as Record<string, string>)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      const counts = await (prisma as Record<string, any>).orSurgicalCount?.findMany?.({
        where: { tenantId, caseId },
        orderBy: { countedAt: 'asc' },
        take: 100,
      }).catch(() => []) || [];

      return NextResponse.json({ counts });
    } catch (e: any) {
      logger.error('[OR surgical-counts GET]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch counts' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.nursing.view' },
);

/** POST /api/or/cases/[caseId]/surgical-counts */
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params) => {
    try {
      const caseId = String((params as Record<string, string>)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      // Verify case
      const orCase = await prisma.orCase.findFirst({ where: { tenantId, id: caseId } });
      if (!orCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

      const body = await req.json();
      const {
        phase, instruments = [], sponges = [], needles = [], blades = [], otherItems = [],
        countedByName, verifiedByUserId, verifiedByName, discrepancyNote,
      } = body;

      if (!phase || !['PRE_OP', 'POST_OP'].includes(phase)) {
        return NextResponse.json({ error: 'phase must be PRE_OP or POST_OP' }, { status: 400 });
      }

      // Two-nurse verification: verifiedByUserId must differ from counter
      if (verifiedByUserId && verifiedByUserId === userId) {
        return NextResponse.json({ error: 'Verifier must be a different nurse than counter' }, { status: 400 });
      }

      // Compute totals
      const allItems = [
        ...instruments.map((i: any) => i), ...sponges.map((i: any) => i),
        ...needles.map((i: any) => i), ...blades.map((i: any) => i),
        ...otherItems.map((i: any) => i),
      ];
      const totals = sumItems(allItems);
      const isDiscrepancy = totals.expected !== totals.actual;

      const count = await (prisma as Record<string, any>).orSurgicalCount?.create?.({
        data: {
          tenantId,
          caseId,
          phase,
          instruments,
          sponges,
          needles,
          blades,
          otherItems,
          totalExpected: totals.expected,
          totalActual: totals.actual,
          isDiscrepancy,
          discrepancyNote: isDiscrepancy ? (discrepancyNote || null) : null,
          discrepancyResolved: false,
          countedByUserId: userId,
          countedByName: countedByName || null,
          verifiedByUserId: verifiedByUserId || null,
          verifiedByName: verifiedByName || null,
          verifiedAt: verifiedByUserId ? new Date() : null,
          countedAt: new Date(),
        },
      });

      return NextResponse.json({ count }, { status: 201 });
    } catch (e: any) {
      logger.error('[OR surgical-counts POST]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to create count' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.nursing.view' },
);
