import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params: Record<string, string>) => {
    try {
      const visit = await prisma.teleVisit.findFirst({ where: { id: params.visitId, tenantId } });
      if (!visit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const { role } = await req.json();
      const data: Record<string, unknown> = {};
      if (role === 'patient') { data.joinedByPatientAt = new Date(); data.status = visit.status === 'SCHEDULED' ? 'WAITING_ROOM' : visit.status; }
      else { data.joinedByDoctorAt = new Date(); data.status = 'IN_CALL'; }
      const item = await prisma.teleVisit.update({ where: { id: params.visitId }, data });
      return NextResponse.json({ item, roomId: visit.roomId || params.visitId });
    } catch (e) {
      return NextResponse.json({ error: 'Failed to join' }, { status: 500 });
    }
  },
  { permissionKey: 'telemedicine.visits.edit' }
);
