import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string; userId: string }) => {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get('doctorId');
    const where: any = { tenantId, isActive: true };
    if (doctorId) where.doctorId = doctorId;
    const slots = await prisma.teleAvailability.findMany({
      where,
      orderBy: [{ doctorId: 'asc' }, { dayOfWeek: 'asc' }],
      take: 500,
    });
    return NextResponse.json({ slots });
  }),
  { permissionKey: 'telemedicine.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();
    const slot = await prisma.teleAvailability.create({
      data: {
        tenantId,
        doctorId: body.doctorId || userId,
        dayOfWeek: Number(body.dayOfWeek),
        startTime: body.startTime,
        endTime: body.endTime,
        slotDuration: body.slotDuration ? Number(body.slotDuration) : 30,
      },
    });
    return NextResponse.json({ slot }, { status: 201 });
  }),
  { permissionKey: 'telemedicine.manage' },
);
