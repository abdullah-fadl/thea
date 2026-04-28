import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { updateAppointmentStatusSchema } from '@/lib/validation/scheduling.schema';
import { withErrorHandler } from '@/lib/core/errors';

const VALID_STATUSES = ['SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const appointmentId = (params as { appointmentId: string } | undefined)?.appointmentId;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, updateAppointmentStatusSchema);
  if ('error' in v) return v.error;

  const { status } = body;

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const existing = await prisma.schedulingReservation.findFirst({
    where: { id: appointmentId, tenantId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
  }

  // [S-03] Validate status transitions to prevent invalid state changes
  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    ACTIVE:       ['SCHEDULED', 'CONFIRMED', 'CANCELLED'],  // Legacy ACTIVE → only initial states
    SCHEDULED:    ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
    CONFIRMED:    ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
    ARRIVED:      ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
    IN_PROGRESS:  ['COMPLETED', 'CANCELLED'],
    COMPLETED:    [],  // terminal
    CANCELLED:    [],  // terminal
    NO_SHOW:      [],  // terminal
  };
  const currentStatus = String(existing.status || 'ACTIVE').toUpperCase();
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed) {
    return NextResponse.json(
      { error: `Unknown current status: ${currentStatus}`, code: 'UNKNOWN_STATE' },
      { status: 409 }
    );
  }
  if (allowed.length === 0) {
    return NextResponse.json(
      { error: `Appointment is in terminal state ${currentStatus}`, code: 'TERMINAL_STATE' },
      { status: 409 }
    );
  }
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${currentStatus} to ${status}`, code: 'INVALID_TRANSITION' },
      { status: 409 }
    );
  }

  const now = new Date();
  const data: Record<string, any> = { status };

  // Map status to the corresponding timestamp column
  if (status === 'CANCELLED') data.cancelledAt = now;
  if (status === 'EXPIRED') data.expiredAt = now;

  const result = await prisma.schedulingReservation.update({
    where: { id: appointmentId! },
    data,
  });

  return NextResponse.json({ success: true, appointment: result });
}),
  { tenantScoped: true, permissionKey: 'scheduling.edit' }
);
