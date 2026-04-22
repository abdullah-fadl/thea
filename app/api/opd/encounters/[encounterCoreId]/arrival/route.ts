import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { normalizeOpdPaymentSnapshot } from '@/lib/opd/payment';
import { validateBody } from '@/lib/validation/helpers';
import { arrivalActionSchema } from '@/lib/validation/opd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ArrivalAction = 'ARRIVE' | 'ROOM' | 'LEAVE';

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {

  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, arrivalActionSchema);
  if ('error' in v) return v.error;
  const { action, visitType, arrivalSource, payment: paymentInput } = v.data;

  const visitTypeRaw = visitType || '';
  const arrivalSourceRaw = arrivalSource || '';

  const { payment, error: paymentError } = normalizeOpdPaymentSnapshot(paymentInput || null);
  if (paymentError) {
    return NextResponse.json({ error: paymentError }, { status: 400 });
  }

  const encounterCore = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounterCore) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (encounterCore.encounterType !== 'OPD') {
    return NextResponse.json({ error: 'Encounter is not OPD' }, { status: 409 });
  }
  if (encounterCore.status === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  const opd = await prisma.opdEncounter.findUnique({
    where: { encounterCoreId },
  });
  if (!opd) {
    return NextResponse.json({ error: 'OPD encounter not found' }, { status: 404 });
  }

  // Optimistic locking
  if (body._version != null && opd.version != null) {
    if (Number(body._version) !== Number(opd.version)) {
      return NextResponse.json(
        { error: 'تم تحديث السجل من شخص آخر. الرجاء إعادة تحميل الصفحة.', code: 'VERSION_CONFLICT' },
        { status: 409 }
      );
    }
  }

  const currentState = String(opd.arrivalState || 'NOT_ARRIVED').toUpperCase();
  let nextState = currentState;

  if (action === 'ARRIVE') {
    if (currentState === 'NOT_ARRIVED') nextState = 'ARRIVED';
    else return NextResponse.json({ success: true, opd, noOp: true });
  }

  if (action === 'ROOM') {
    if (currentState === 'NOT_ARRIVED') {
      return NextResponse.json({ error: 'Patient has not arrived' }, { status: 409 });
    }
    if (currentState === 'IN_ROOM') return NextResponse.json({ success: true, opd, noOp: true });
    if (currentState === 'LEFT') return NextResponse.json({ error: 'Patient already left' }, { status: 409 });
    nextState = 'IN_ROOM';
  }

  if (action === 'LEAVE') {
    if (currentState === 'LEFT') return NextResponse.json({ success: true, opd, noOp: true });
    if (currentState === 'NOT_ARRIVED') {
      return NextResponse.json({ error: 'Patient has not arrived' }, { status: 409 });
    }
    nextState = 'LEFT';
  }

  const now = new Date();
  const updateData: Record<string, unknown> = { arrivalState: nextState as string };

  if (action === 'ARRIVE' && !opd.arrivedAt) {
    updateData.arrivedAt = now;
  }
  if (action === 'ARRIVE' && !opd.arrivalSource) {
    updateData.arrivalSource = (arrivalSourceRaw || 'RECEPTION') as string;
  }
  if (visitTypeRaw && !opd.visitType) {
    updateData.visitType = visitTypeRaw as any;
  }
  if (action === 'ARRIVE' && payment && !opd.paymentStatus) {
    updateData.paymentStatus = payment.status;
    updateData.paymentServiceType = payment.serviceType;
    updateData.paymentAmount = payment.amount;
    updateData.paymentMethod = payment.method;
    updateData.paymentPaidAt = payment.paidAt;
    updateData.paymentInvoiceId = payment.invoiceId;
    updateData.paymentReference = payment.reference;
  }

  const updatedOpd = await prisma.opdEncounter.update({
    where: { encounterCoreId },
    data: { ...updateData, version: { increment: 1 } },
  });

  await createAuditLog(
    'opd_encounter',
    String(opd.id || encounterCoreId),
    `ARRIVAL_${action}`,
    userId || 'system',
    user?.email,
    { before: opd, after: updatedOpd },
    tenantId
  );

  return NextResponse.json({ success: true, opd: updatedOpd });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.nursing.flow' }
);
