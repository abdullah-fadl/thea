import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { rescheduleAppointmentSchema } from '@/lib/validation/scheduling.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const appointmentId = (params as { appointmentId: string } | undefined)?.appointmentId;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, rescheduleAppointmentSchema);
  if ('error' in v) return v.error;

  const startAt = body.startAt ? new Date(body.startAt) : null;
  const endAt = body.endAt ? new Date(body.endAt) : null;

  if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return NextResponse.json({ error: 'Invalid startAt/endAt' }, { status: 400 });
  }

  const existing = await prisma.schedulingReservation.findFirst({
    where: { id: appointmentId, tenantId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
  }

  // [S-02] Rate limit: max 5 reschedules per appointment per day
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentReschedules = await prisma.auditLog.count({
    where: {
      tenantId,
      resourceType: 'scheduling_appointment',
      resourceId: appointmentId,
      action: 'RESCHEDULE',
      timestamp: { gte: oneDayAgo },
    },
  });
  if (recentReschedules >= 5) {
    return NextResponse.json(
      { error: 'Too many reschedules. Maximum 5 per day per appointment.', code: 'RESCHEDULE_LIMIT' },
      { status: 429 }
    );
  }

  // Update the linked slot's times (startAt/endAt live on the slot, not the reservation)
  await prisma.schedulingSlot.update({
    where: { id: existing.slotId },
    data: { startAt, endAt },
  });

  // Return the reservation with the updated slot times for backwards compatibility
  const result = {
    ...existing,
    startAt,
    endAt,
  };

  return NextResponse.json({ success: true, appointment: result });
}),
  { tenantScoped: true, permissionKey: 'scheduling.edit' }
);
