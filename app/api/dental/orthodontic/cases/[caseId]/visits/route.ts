import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const items = await (prisma as Record<string, any>).orthodonticVisit.findMany({
        where: { tenantId, caseId: params?.caseId }, orderBy: { visitDate: 'desc' },
      });
      return NextResponse.json({ items });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'dental.orthodontic.view' }
);
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params: any) => {
    try {
      const body = await req.json();
      const item = await (prisma as Record<string, any>).orthodonticVisit.create({
        data: { tenantId, caseId: params?.caseId, ...body, doctorId: body.doctorId || userId },
      });
      return NextResponse.json({ item }, { status: 201 });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'dental.orthodontic.edit' }
);
