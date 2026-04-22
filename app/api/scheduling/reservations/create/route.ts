import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canManageScheduling } from '@/lib/scheduling/access';
import { validateBody } from '@/lib/validation/helpers';
import { createReservationSchema } from '@/lib/validation/scheduling.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RES_TYPES = new Set(['HOLD', 'BOOKING']);
const SUBJECT_TYPES = new Set(['ENCOUNTER_CORE', 'PATIENT_MASTER', 'EXTERNAL_REF']);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canManageScheduling({ user, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createReservationSchema);
  if ('error' in v) return v.error;

  const missing: string[] = [];
  const slotId = String(body.slotId || '').trim();
  const reservationType = String(body.reservationType || '').trim().toUpperCase();
  const subjectType = String(body.subjectType || '').trim().toUpperCase();
  const subjectId = String(body.subjectId || '').trim();
  const notes = body.notes ? String(body.notes || '').trim() : null;
  const expiresAtRaw = body.expiresAt ? String(body.expiresAt || '').trim() : null;
  const idempotencyKey = String(body.idempotencyKey || '').trim();

  if (!slotId) missing.push('slotId');
  if (!reservationType) missing.push('reservationType');
  if (!subjectType) missing.push('subjectType');
  if (!subjectId) missing.push('subjectId');
  if (!idempotencyKey) missing.push('idempotencyKey');
  if (missing.length) {
    return NextResponse.json({ error: 'Validation failed', missing }, { status: 400 });
  }

  if (!RES_TYPES.has(reservationType)) {
    return NextResponse.json({ error: 'Invalid reservationType' }, { status: 400 });
  }
  if (!SUBJECT_TYPES.has(subjectType)) {
    return NextResponse.json({ error: 'Invalid subjectType' }, { status: 400 });
  }

  const slot = await prisma.schedulingSlot.findFirst({
    where: { tenantId, id: slotId },
  });
  if (!slot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }
  if (slot.status !== 'OPEN') {
    return NextResponse.json({ error: 'Slot not open', currentStatus: slot.status }, { status: 409 });
  }

  let expiresAt: Date | null = null;
  if (reservationType === 'HOLD') {
    if (!expiresAtRaw) {
      return NextResponse.json({ error: 'expiresAt is required for HOLD' }, { status: 400 });
    }
    expiresAt = new Date(expiresAtRaw);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return NextResponse.json({ error: 'expiresAt must be in the future' }, { status: 400 });
    }
  }

  // Check idempotency
  const existingByKey = await prisma.schedulingReservation.findFirst({
    where: { tenantId, idempotencyKey },
  });
  if (existingByKey) {
    return NextResponse.json({ success: true, noOp: true, reservation: existingByKey });
  }

  const now = new Date();
  const reservationId = uuidv4();
  const reservationData = {
    id: reservationId,
    tenantId,
    reservationId,
    slotId,
    resourceId: slot.resourceId,
    reservationType,
    subjectType,
    subjectId,
    notes,
    status: 'ACTIVE',
    expiresAt,
    createdByUserId: userId || null,
    idempotencyKey,
  };

  // [S-01] Wrap reservation + slot update in transaction to prevent race conditions
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check slot status inside transaction
      const freshSlot = await tx.schedulingSlot.findFirst({
        where: { tenantId, id: slotId },
      });
      if (!freshSlot || freshSlot.status !== 'OPEN') {
        throw new Error('JSON:{"error":"Slot not open","status":409}');
      }

      const reservation = await tx.schedulingReservation.create({ data: reservationData });

      const updateResult = await tx.schedulingSlot.updateMany({
        where: { tenantId, id: slotId, status: 'OPEN' },
        data: { status: reservationType === 'HOLD' ? 'HELD' : 'BOOKED' },
      });

      if (updateResult.count === 0) {
        throw new Error('JSON:{"error":"Slot conflict","status":409}');
      }

      return reservation;
    });

    const updatedSlot = await prisma.schedulingSlot.findUnique({ where: { id: slotId } });

    await createAuditLog(
      'scheduling_reservation',
      reservationId,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: reservationData },
      tenantId
    );
    await createAuditLog(
      'scheduling_slot',
      slotId,
      'STATUS_CHANGE',
      userId || 'system',
      user?.email,
      { before: slot, after: updatedSlot },
      tenantId
    );

    return NextResponse.json({ reservation: result });
  } catch (err: any) {
    // Handle JSON-encoded errors thrown from within the transaction
    if (err?.message?.startsWith('JSON:')) {
      const parsed = JSON.parse(err.message.slice(5));
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    // Handle unique constraint violation (idempotencyKey race)
    if (err?.code === 'P2002') {
      const existingActive = await prisma.schedulingReservation.findFirst({
        where: { tenantId, idempotencyKey },
      });
      if (existingActive) {
        return NextResponse.json({ success: true, noOp: true, reservation: existingActive });
      }
      return NextResponse.json({ error: 'Slot already reserved' }, { status: 409 });
    }
    throw err;
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.edit' }
);
