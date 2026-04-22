import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const annotation = await req.json();
      const existing = await (prisma as any).ctgRecording.findFirst({ where: { id: params.recordingId, tenantId } }) as any;
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const annotations = [...(Array.isArray(existing.annotations) ? existing.annotations : []), { ...annotation, timestamp: new Date().toISOString() }];
      const item = await (prisma as any).ctgRecording.update({ where: { id: params.recordingId }, data: { annotations } });
      return NextResponse.json({ item });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'obgyn.ctg.edit' }
);
