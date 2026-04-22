import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const all = await prisma.radiologyPeerReview.findMany({ where: { tenantId }, take: 500 });
      const total = all.length;
      const scored = all.filter((r: any) => r.score);
      const agree = scored.filter((r: any) => r.score === 'AGREE').length;
      const minor = scored.filter((r: any) => r.score === 'MINOR_DISCREPANCY').length;
      const major = scored.filter((r: any) => r.score === 'MAJOR_DISCREPANCY').length;
      const miss = scored.filter((r: any) => r.score === 'MISS').length;
      const discrepancyRate = scored.length > 0 ? Math.round(((minor + major + miss) / scored.length) * 100) : 0;
      return NextResponse.json({ total, scored: scored.length, agree, minor, major, miss, discrepancyRate });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'radiology.peer-review.view' }
);
