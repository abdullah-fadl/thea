import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string; userId: string }) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const doctorId = searchParams.get('doctorId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: any = { tenantId };
    if (status) where.status = status;
    if (doctorId) where.doctorId = doctorId;
    if (dateFrom || dateTo) {
      const scheduledAt: Record<string, Date> = {};
      if (dateFrom) scheduledAt.gte = new Date(dateFrom);
      if (dateTo) scheduledAt.lte = new Date(dateTo);
      where.scheduledAt = scheduledAt;
    }

    const consultations = await prisma.teleConsultation.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ consultations });
  }),
  { permissionKey: 'telemedicine.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();
    const consultation = await prisma.teleConsultation.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        doctorId: body.doctorId || userId,
        scheduledAt: new Date(body.scheduledAt),
        duration: body.duration ? Number(body.duration) : 30,
        type: body.type || 'VIDEO',
        chiefComplaint: body.chiefComplaint ?? null,
        notes: body.notes ?? null,
        meetingUrl: body.meetingUrl ?? null,
        meetingId: body.meetingId ?? null,
      },
    });
    return NextResponse.json({ consultation }, { status: 201 });
  }),
  { permissionKey: 'telemedicine.manage' },
);
