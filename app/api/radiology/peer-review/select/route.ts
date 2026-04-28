import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const { percentage = 10, modality } = await req.json();
      // Get recent studies not yet reviewed
      const where: any = { tenantId };
      if (modality) where.modality = modality;
      const reports = await (prisma as any).radiologyReport?.findMany?.({ where, orderBy: { createdAt: 'desc' }, take: 100 }) || [];
      const count = Math.max(1, Math.floor(reports.length * percentage / 100));
      // Random selection
      const shuffled = reports.sort(() => Math.random() - 0.5).slice(0, count);
      return NextResponse.json({ selected: shuffled.length, studies: shuffled.map((s: any) => ({ studyId: s.studyId || s.id, modality: s.modality })) });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'radiology.peer-review.edit' }
);
