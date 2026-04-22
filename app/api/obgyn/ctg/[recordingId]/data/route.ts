import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const { fhrPoints, contractionPoints } = await req.json();
      const existing = await (prisma as any).ctgRecording.findFirst({ where: { id: params.recordingId, tenantId } }) as any;
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const fhrData = [...(Array.isArray(existing.fhrData) ? existing.fhrData : []), ...(fhrPoints || [])];
      const contractionData = [...(Array.isArray(existing.contractionData) ? existing.contractionData : []), ...(contractionPoints || [])];
      const item = await (prisma as any).ctgRecording.update({
        where: { id: params.recordingId }, data: { fhrData, contractionData },
      });
      return NextResponse.json({ item });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'obgyn.ctg.edit' }
);
