import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const { response } = await req.json();
      const item = await prisma.schedulingWaitlist.update({
        where: { id: params.entryId, tenantId },
        data: { status: response === 'accept' ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
      });
      return NextResponse.json({ item });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'scheduling.waitlist.edit' }
);
