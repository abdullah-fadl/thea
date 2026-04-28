import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const patientId = url.searchParams.get('patientId');
      if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });
      const charts = await (prisma as any).periodontalChart.findMany({
        where: { tenantId, patientId },
        orderBy: { chartDate: 'desc' }, take: 2,
      });
      return NextResponse.json({ current: charts[0] || null, previous: charts[1] || null });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'dental.periodontal.view' }
);
