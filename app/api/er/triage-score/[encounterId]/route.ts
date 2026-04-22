import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const items = await (prisma as Record<string, any>).erTriageScore.findMany({
        where: { tenantId, encounterId: params.encounterId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return NextResponse.json({ items });
    } catch (e) {
      return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.triage-score.view' }
);
