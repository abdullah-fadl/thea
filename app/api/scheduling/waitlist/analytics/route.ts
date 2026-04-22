import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const all = await prisma.schedulingWaitlist.findMany({ where: { tenantId }, take: 500 });
      const waiting = all.filter((w: any) => w.status === 'WAITING').length;
      const offered = all.filter((w: any) => w.status === 'OFFERED').length;
      const accepted = all.filter((w: any) => w.status === 'ACCEPTED').length;
      const declined = all.filter((w: any) => w.status === 'DECLINED').length;
      const conversionRate = (accepted + declined) > 0 ? Math.round((accepted / (accepted + declined)) * 100) : 0;
      return NextResponse.json({ total: all.length, waiting, offered, accepted, declined, conversionRate });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'scheduling.waitlist.view' }
);
