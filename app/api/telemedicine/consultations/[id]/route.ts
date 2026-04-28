import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string; userId: string }, params: unknown) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const consultation = await prisma.teleConsultation.findFirst({ where: { id, tenantId } });
    if (!consultation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ consultation });
  }),
  { permissionKey: 'telemedicine.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string; userId: string }, params: unknown) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await req.json();
    const existing = await prisma.teleConsultation.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updateData: any = { updatedAt: new Date() };
    if (body.status) {
      updateData.status = body.status;
      if (body.status === 'IN_PROGRESS' && !existing.startedAt) {
        updateData.startedAt = new Date();
      }
      if (body.status === 'COMPLETED' && !existing.endedAt) {
        updateData.endedAt = new Date();
        if (existing.startedAt) {
          updateData.actualDuration = Math.round(
            (Date.now() - existing.startedAt.getTime()) / 60000,
          );
        }
      }
    }
    if (body.notes != null) updateData.notes = body.notes;
    if (body.prescription != null) updateData.prescription = body.prescription;
    if (body.followUpNeeded != null) updateData.followUpNeeded = Boolean(body.followUpNeeded);
    if (body.followUpDate) updateData.followUpDate = new Date(body.followUpDate);
    if (body.patientRating != null) updateData.patientRating = Number(body.patientRating);
    if (body.patientFeedback != null) updateData.patientFeedback = body.patientFeedback;
    if (body.meetingUrl != null) updateData.meetingUrl = body.meetingUrl;

    const updated = await prisma.teleConsultation.update({ where: { id }, data: updateData });
    return NextResponse.json({ consultation: updated });
  }),
  { permissionKey: 'telemedicine.manage' },
);
