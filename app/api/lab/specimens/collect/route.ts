import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { nanoid } from 'nanoid';
import { checkOrderPayment } from '@/lib/billing/paymentGate';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { createAuditLog } from '@/lib/utils/audit';

const collectSpecimenBodySchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  specimenId: z.string().optional(),
  tubeType: z.string().optional(),
  collectedAt: z.string().optional(),
  collectedBy: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  const body = await req.json().catch(() => ({}));
  const v = validateBody(body, collectSpecimenBodySchema);
  if ('error' in v) return v.error;
  const { orderId, specimenId, tubeType, collectedAt, notes } = v.data;

  const order = await prisma.ordersHub.findFirst({
    where: { id: orderId, tenantId, kind: 'LAB' },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.status !== 'ORDERED') {
    return NextResponse.json({ error: 'Order already processed' }, { status: 400 });
  }

  const paymentCheck = await checkOrderPayment(null, tenantId, orderId, 'LAB');
  if (!paymentCheck.allowed) {
    return NextResponse.json(
      {
        error: 'PAYMENT_REQUIRED',
        message: paymentCheck.reason,
        paymentStatus: paymentCheck.paymentStatus,
      },
      { status: 402 }
    );
  }

  const now = new Date();
  const specimen = await prisma.labSpecimen.create({
    data: {
      id: crypto.randomUUID(),
      specimenId: specimenId || `SP-${nanoid(8).toUpperCase()}`,
      tenantId,
      orderId,
      patientId: order.patientMasterId || undefined,
      encounterId: order.encounterCoreId || undefined,
      testCode: order.orderCode || undefined,
      tubeType,
      collectedAt: collectedAt ? new Date(collectedAt) : now,
      collectedBy: userId,
      collectorName: body.collectedBy || user?.displayName || user?.email || null,
      notes: notes || null,
      status: 'COLLECTED',
      createdAt: now,
    },
  });

  const specimenLabel = specimen.specimenId;
  const collectedAtDate = specimen.collectedAt;

  // ordersHub has no specimenId/collectedAt/collectedBy columns — store in meta
  await prisma.ordersHub.updateMany({
    where: { id: orderId, tenantId },
    data: {
      status: 'COLLECTED',
      acceptedAt: collectedAtDate,
      updatedAt: now,
      meta: {
        ...(typeof order.meta === 'object' && order.meta !== null ? order.meta as Record<string, unknown> : {}),
        specimenId: specimenLabel,
        collectedAt: collectedAtDate,
        collectedBy: userId,
      },
    },
  });

  // Also update lab_orders for backward compatibility (fire-and-forget)
  prisma.labOrder.updateMany({
    where: { id: orderId, tenantId },
    data: {
      status: 'COLLECTED',
      specimenId: specimenLabel,
      collectedAt: collectedAtDate,
      collectedBy: userId,
      updatedAt: now,
    },
  }).catch(() => {});

  await createAuditLog(
    'lab_specimen',
    specimen.id,
    'SPECIMEN_COLLECTED',
    userId || 'system',
    user?.email,
    { orderId, specimenId: specimen.specimenId },
    tenantId
  );

  return NextResponse.json({ success: true, specimen });
}),
  { tenantScoped: true, permissionKey: 'lab.specimens.create' });
