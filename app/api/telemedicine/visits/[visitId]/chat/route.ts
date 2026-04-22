import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: Record<string, string>) => {
    try {
      const visit = await prisma.teleVisit.findFirst({ where: { id: params.visitId, tenantId } });
      return NextResponse.json({ chatLog: visit?.chatLog || [] });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'telemedicine.visits.view' }
);
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params: Record<string, string>) => {
    try {
      const { message } = await req.json();
      const visit = await prisma.teleVisit.findFirst({ where: { id: params.visitId, tenantId } });
      const chatLog = Array.isArray(visit?.chatLog) ? visit.chatLog : [];
      chatLog.push({ sender: userId, message, timestamp: new Date().toISOString() });
      const item = await prisma.teleVisit.update({ where: { id: params.visitId }, data: { chatLog } });
      return NextResponse.json({ chatLog: item.chatLog });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'telemedicine.visits.edit' }
);
